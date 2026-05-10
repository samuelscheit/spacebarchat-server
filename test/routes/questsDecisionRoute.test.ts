/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express, { type Request } from "express";
import { ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import { QUEST_DECISION_RESPONSE_TTL_SECONDS, buildQuestDecisionResponse, createQuestDecisionRouter, parseQuestDecisionQuery } from "../../src/api/routes/quests/decision";

const coveredManifestIds = ["api:http:GET:/quests/decision/"];
const userId = "223456789012345678";
const requestId = "11111111-2222-4333-8444-555555555555";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    anyOf?: JsonSchema[];
};

describe("GET /quests/decision", () => {
    test("declares the quest decision manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/quests/decision/"]);
    });

    test("parses the documented placement query and optional heartbeat session", () => {
        assert.deepEqual(
            parseQuestDecisionQuery({
                placement: "1",
                client_heartbeat_session_id: "heartbeat-session",
            } as unknown as Request["query"]),
            {
                placement: 1,
                client_heartbeat_session_id: "heartbeat-session",
            },
        );
        assert.deepEqual(parseQuestDecisionQuery({ placement: ["2", "1"] } as unknown as Request["query"]), {
            placement: 2,
        });

        assert.throws(() => parseQuestDecisionQuery({} as unknown as Request["query"]), {
            message: "Invalid Form Body",
        });
        assert.throws(() => parseQuestDecisionQuery({ placement: "0" } as unknown as Request["query"]), {
            message: "Invalid Form Body",
        });
        assert.throws(() => parseQuestDecisionQuery({ placement: "not-an-integer" } as unknown as Request["query"]), {
            message: "Invalid Form Body",
        });
    });

    test("returns a conservative authenticated no-decision response without quest or ad fabrication", async () => {
        assert.deepEqual(buildQuestDecisionResponse(userId, { placement: 1 }, requestId), expectedQuestDecisionResponse());

        const app = createRouteApp();
        const response = await requestJson(
            app,
            "/quests/decision?placement=1&client_heartbeat_session_id=heartbeat-session&client_ad_session_id=ad-session&visible_guild_ids=123456789012345678&visible_guild_ids=223456789012345678",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, expectedQuestDecisionResponse());
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("rejects invalid documented query values before response construction", async () => {
        const response = await requestJson(createRouteApp(), "/quests/decision?placement=3");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
    });

    test("declares source-backed metadata and remains bearer-authenticated", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "quests", "decision.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Quest Placement"/);
        assert.match(routeSource, /placement:\s*\{\s*type:\s*"integer",\s*required:\s*true/s);
        assert.match(routeSource, /client_heartbeat_session_id:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestDecisionResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /right:\s*"OPERATOR"|emitEvent|QUESTS_USER_STATUS_UPDATE/);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/decision?placement=1"), false);
    });

    test("is present in regenerated route artifacts and removed from exact missing-route ownership", () => {
        const catalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as Array<{
            method: string;
            route: string;
            route_name: string;
            source: string;
            response_schema_refs?: string[];
        }>;
        const missing = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries: Array<{ method: string; route: string }>;
        };

        const entry = catalog.find((route) => route.method === "GET" && route.route === "/quests/decision");
        assert.deepEqual(entry, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse", "QuestDecisionResponse"],
            route: "/quests/decision",
            route_name: "GET_QUESTS_DECISION",
            source: "src/api/routes/quests/decision.ts",
        });
        assert.equal(
            missing.missing_entries.some((route) => route.method === "GET" && route.route === "/quests/decision"),
            false,
        );
        assert.equal(
            missing.missing_entries.some((route) => route.route === "/quests/decision?placement={param}&client_heartbeat_session_id={param}"),
            true,
        );
    });

    test("generates response schema, OpenAPI, and testing manifest metadata", () => {
        const schemas = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: Array<{
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }>;
        };

        assert.equal(schemas.QuestDecisionResponse.type, "object");
        assert.deepEqual(schemas.QuestDecisionResponse.required?.sort(), [
            "ad_context",
            "ad_identifiers",
            "creative",
            "metadata_raw",
            "metadata_sealed",
            "quest",
            "request_id",
            "response_ttl_seconds",
            "traffic_metadata_raw",
            "traffic_metadata_sealed",
        ]);
        assert.deepEqual(
            schemas.QuestDecisionResponse.properties?.quest?.anyOf?.map((schema) => schema.type ?? schema.$ref),
            ["#/definitions/QuestResponse", "null"],
        );
        assert.deepEqual(schemas.QuestDecisionResponse.properties?.response_ttl_seconds?.type, "integer");

        const operation = openapi.paths?.["/quests/decision/"]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestDecisionResponse");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(
            operation?.parameters?.some(
                (parameter) => parameter.name === "placement" && parameter.in === "query" && parameter.required === true && parameter.schema?.type === "integer",
            ),
            true,
        );
        assert.equal(
            operation?.parameters?.some((parameter) => parameter.name === "client_heartbeat_session_id" && parameter.in === "query"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestDecisionResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401],
        );
    });
});

function expectedQuestDecisionResponse() {
    return {
        request_id: requestId,
        quest: null,
        ad_identifiers: null,
        ad_context: null,
        metadata_raw: null,
        metadata_sealed: null,
        traffic_metadata_raw: null,
        traffic_metadata_sealed: null,
        creative: null,
        response_ttl_seconds: QUEST_DECISION_RESPONSE_TTL_SECONDS,
    };
}

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use(
        "/quests/decision",
        createQuestDecisionRouter(() => requestId),
    );
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address();
        assert(address && typeof address === "object");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await close(server);
    }
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

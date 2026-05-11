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
import { join } from "node:path";
import { describe, test } from "node:test";
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { QuestRewardCodeResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createQuestRewardCodeRouter,
    getConfiguredQuestRewardCode,
    getQuestRewardCode,
    toQuestRewardCodeResponse,
    type QuestRewardCodeProvider,
    type QuestRewardCodeSource,
} from "../../src/api/routes/quests/#quest_id/reward-code";
import { UNKNOWN_QUEST, assertValidQuestConfigId } from "../../src/api/routes/quests/#quest_id/index";

const coveredManifestIds = ["api:http:GET:/quests/:quest_id/reward-code/"];
const questId = "8206816794116096000";
const userId = "222069018507345921";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    anyOf?: JsonSchema[];
};

describe("GET /quests/:quest_id/reward-code", () => {
    test("returns only provider-backed reward-code data for the authenticated user", async () => {
        const source = {
            ...sampleQuestRewardCode,
            internal_notes: "do not serialize",
        } as QuestRewardCodeSource & { internal_notes: string };
        const response = await requestJson(
            createRouteApp(() => source),
            `/quests/${questId}/reward-code`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, expectedQuestRewardCode);
        assert.equal((response.body as QuestRewardCodeResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.deepEqual(toQuestRewardCodeResponse(source), expectedQuestRewardCode);
    });

    test("fails closed for absent, malformed, or cross-user reward-code state", async () => {
        let providerCalled = false;

        assert.equal(getConfiguredQuestRewardCode(questId, userId), undefined);
        assert.doesNotThrow(() => assertValidQuestConfigId(questId));
        await assert.rejects(() => getQuestRewardCode(questId, userId, () => undefined), isUnknownQuestError);
        await assert.rejects(() => getQuestRewardCode(questId, userId, () => ({ ...sampleQuestRewardCode, user_id: "333333333333333333" })), isUnknownQuestError);
        await assert.rejects(() => getQuestRewardCode(questId, userId, () => ({ ...sampleQuestRewardCode, claimed_at: "not-a-date" })), isUnknownQuestError);
        await assert.rejects(
            () =>
                getQuestRewardCode("not-a-snowflake", userId, () => {
                    providerCalled = true;
                    return sampleQuestRewardCode;
                }),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );
        assert.equal(providerCalled, false);

        const missingResponse = await requestJson(createRouteApp(), `/quests/${questId}/reward-code`);
        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_QUEST.code,
            message: UNKNOWN_QUEST.message,
        });

        const invalidResponse = await requestJson(
            createRouteApp(() => sampleQuestRewardCode),
            "/quests/not-a-snowflake/reward-code",
        );
        assert.equal(invalidResponse.status, 400);
        assert.equal((invalidResponse.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("remains bearer-authenticated and does not make adjacent quest routes public", async () => {
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}/reward-code`), false);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v9/quests/${questId}/reward-code/`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/quests/${questId}`), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/quests/decision?placement=1"), false);

        const response = await requestJson(
            createRouteApp(() => sampleQuestRewardCode),
            `/quests/${questId}/reward-code`,
        );
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, expectedQuestRewardCode);
    });

    test("declares source-backed metadata for the authenticated reward-code contract", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "quests", "#quest_id", "reward-code.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Quest Reward Code"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"QuestRewardCodeResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /right:\s*"OPERATOR"|QuestUserStatusResponse|emitEvent|QUESTS_USER_STATUS_UPDATE/);
    });

    test("generates response schema, source catalog, OpenAPI, manifest, contracts, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.equal(schemas.QuestRewardCodeResponse.type, "object");
        assert.deepEqual(schemas.QuestRewardCodeResponse.required?.sort(), ["claimed_at", "code", "platform", "quest_id", "tier", "user_id"]);
        assert.equal(schemas.QuestRewardCodeResponse.properties?.quest_id?.type, "string");
        assert.equal(schemas.QuestRewardCodeResponse.properties?.user_id?.type, "string");
        assert.equal(schemas.QuestRewardCodeResponse.properties?.code?.type, "string");
        assert.equal(schemas.QuestRewardCodeResponse.properties?.platform?.type, "integer");
        assert.deepEqual(schemas.QuestRewardCodeResponse.properties?.tier?.type, ["null", "integer"]);

        const route = openapi.paths?.["/quests/{quest_id}/reward-code/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/QuestRewardCodeResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "quest_id" && parameter.in === "path" && parameter.required === true),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/quests/{quest_id}/reward-code");
        assert.equal(sourceEntry?.route_name, "GET_QUESTS_QUEST_ID_REWARD_CODE");
        assert.equal(sourceEntry?.source, "src/api/routes/quests/#quest_id/reward-code.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "QuestRewardCodeResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/quests/#quest_id/reward-code.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "QuestRewardCodeResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/quests/:quest_id/reward-code/");
        assert.equal(contract?.routeMetadata?.responses?.includes("QuestRewardCodeResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === "/quests/{param}/reward-code" && entry.route_name === "GET_QUESTS_QUEST_ID_REWARD_CODE",
            ),
            false,
        );
    });
});

const sampleQuestRewardCode: QuestRewardCodeSource = {
    quest_id: questId,
    code: "111-1111111",
    platform: 0,
    user_id: userId,
    claimed_at: new Date("2077-01-01T18:41:29.706Z"),
    tier: null,
};

const expectedQuestRewardCode: QuestRewardCodeResponse = {
    quest_id: questId,
    code: "111-1111111",
    platform: 0,
    user_id: userId,
    claimed_at: "2077-01-01T18:41:29.706Z",
    tier: null,
};

function createRouteApp(provider: QuestRewardCodeProvider = getConfiguredQuestRewardCode) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/quests/:quest_id/reward-code", createQuestRewardCodeRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function isUnknownQuestError(error: unknown): boolean {
    return (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_QUEST.code && (error as { message?: unknown }).message === UNKNOWN_QUEST.message;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address();
        assert(address && typeof address === "object");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, init);

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

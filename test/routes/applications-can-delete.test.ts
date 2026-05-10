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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import {
    buildApplicationCanDeleteResponse,
    canViewApplicationDeletionState,
    createApplicationCanDeleteRouter,
    getApplicationCanDeleteResponse,
    type ApplicationCanDeleteRepositories,
} from "../../src/api/routes/applications/#application_id/can-delete";
import { TeamMemberState } from "../../src/schemas/api/developers/Team";
import { DiscordApiErrors } from "../../src/util";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/can-delete/"];

type JsonSchema = {
    anyOf?: JsonSchema[];
    enum?: unknown[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
    $ref?: string;
};

function createApp(repositories: ApplicationCanDeleteRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/can-delete", createApplicationCanDeleteRouter(repositories));
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function propertyTypes(schema: JsonSchema) {
    if (Array.isArray(schema.type)) return schema.type.toSorted();
    if (typeof schema.type === "string") return [schema.type];
    return [];
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

describe("GET /applications/:application_id/can-delete", () => {
    test("loads the application owner and team before returning the local deletion state", async (t) => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/can-delete/"]);
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await getApplicationCanDeleteResponse("application-id", "owner", { applicationRepository });

        assert.deepEqual(response, { deletable: true });
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "application-id" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
    });

    test("allows the application owner, team owner, and accepted owning-team members", () => {
        assert.equal(canViewApplicationDeletionState({ owner: { id: "owner" } }, "owner"), true);
        assert.equal(
            canViewApplicationDeletionState(
                {
                    owner: { id: "owner" },
                    team: {
                        owner_user_id: "team-owner",
                        members: [],
                    },
                },
                "team-owner",
            ),
            true,
        );
        assert.equal(
            canViewApplicationDeletionState(
                {
                    owner: { id: "owner" },
                    team: {
                        members: [
                            {
                                user_id: "accepted-member",
                                membership_state: TeamMemberState.ACCEPTED,
                            },
                        ],
                    },
                },
                "accepted-member",
            ),
            true,
        );
    });

    test("rejects users who cannot access the owning application or team", async (t) => {
        assert.equal(
            canViewApplicationDeletionState(
                {
                    owner: { id: "owner" },
                    team: {
                        owner_user_id: "team-owner",
                        members: [
                            {
                                user_id: "invited-member",
                                membership_state: TeamMemberState.INVITED,
                            },
                        ],
                    },
                },
                "invited-member",
            ),
            false,
        );

        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        await assert.rejects(
            () => getApplicationCanDeleteResponse("application-id", "intruder", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
    });

    test("throws unknown application before building a deletion response", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => getApplicationCanDeleteResponse("missing-application", "owner", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
    });

    test("does not fabricate Discord-only undeletable reasons Spacebar cannot persist locally", () => {
        const response = buildApplicationCanDeleteResponse({
            owner: { id: "owner" },
            approximate_user_install_count: 10_000,
            parent_id: "parent-application",
        } as never) as Record<string, unknown>;

        assert.deepEqual(response, { deletable: true });
        assert.equal("reason" in response, false);
    });

    test("returns the mounted route response for an application owner", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await requestJson(createApp({ applicationRepository }), "/applications/application-id/can-delete");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { deletable: true });
    });

    test("returns the mounted route unknown application response", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestJson(createApp({ applicationRepository }), "/applications/missing-application/can-delete");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("returns the mounted route authorization response for non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        const response = await requestJson(createApp({ applicationRepository }, "intruder"), "/applications/application-id/can-delete");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("documents authenticated route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "can-delete.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application Undeletable Reason"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationCanDeleteResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates source catalog, OpenAPI, testing manifest, contract, and schema metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/applications/{application_id}/can-delete");
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_CAN_DELETE");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/#application_id/can-delete.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationCanDeleteResponse"]);

        const route = openapi.paths?.["/applications/{application_id}/can-delete/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationCanDeleteResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const responseSchema = schemas.ApplicationCanDeleteResponse;
        assert.deepEqual(propertyTypes(responseSchema.properties?.deletable ?? {}), ["boolean", "null"]);
        assert.deepEqual(responseSchema.properties?.reason?.anyOf, [{ enum: [0, 1, 2, 3], type: "number" }, { type: "null" }]);
        assert.equal(responseSchema.required, undefined);
        assert.deepEqual(openapi.components?.schemas?.ApplicationCanDeleteResponse?.properties?.reason?.anyOf, [{ enum: [0, 1, 2, 3], type: "number" }, { type: "null" }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationCanDeleteResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationCanDeleteResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
    });
});

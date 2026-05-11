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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { TeamMemberRole, TeamMemberState } from "@spacebar/schemas";
import express from "express";
import {
    canUseApplicationTestMode,
    createApplicationTestModeRouter,
    queryApplicationTestMode,
    setApplicationTestMode,
    type ApplicationTestModeRepository,
    type ApplicationTestModeRepositories,
} from "../../src/api/routes/activities/#application_id/test-mode";
import { DiscordApiErrors } from "../../src/util";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/activities/:application_id/test-mode/", "api:http:POST:/activities/:application_id/test-mode/"];

type JsonSchema = {
    $ref?: string;
};

type RouteArtifacts = {
    sourceCatalog: {
        method?: string;
        response_schema_refs?: string[];
        route?: string;
        route_name?: string;
        source?: string;
    }[];
    openapi: {
        paths?: Record<
            string,
            Record<
                string,
                {
                    responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                    security?: unknown;
                }
            >
        >;
    };
    manifest: {
        entries?: {
            authMode?: string;
            id?: string;
            routeMetadata?: {
                responseBodies?: string[];
                responseStatuses?: number[];
            };
        }[];
    };
    contracts: {
        contracts?: {
            authMode?: string;
            manifestId?: string;
            routeMetadata?: {
                responses?: string[];
                responseStatuses?: number[];
            };
            sourceFile?: string;
        }[];
    };
};

function repositories(overrides: Partial<ApplicationTestModeRepository> = {}): ApplicationTestModeRepositories {
    return {
        applicationRepository: {
            findOne: async () => ({
                owner: { id: "owner" },
                team: {
                    owner_user_id: "team-owner",
                    members: [
                        {
                            user_id: "developer",
                            membership_state: TeamMemberState.ACCEPTED,
                            role: TeamMemberRole.DEVELOPER,
                        },
                    ],
                },
            }),
            ...overrides,
        },
    };
}

function createApp(routeRepositories: ApplicationTestModeRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/activities/:application_id/test-mode", createApplicationTestModeRouter(routeRepositories));
    app.use(ErrorHandler);
    return app;
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.UNKNOWN_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

function loadRouteArtifacts(): RouteArtifacts {
    return {
        sourceCatalog: JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as RouteArtifacts["sourceCatalog"],
        openapi: JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as RouteArtifacts["openapi"],
        manifest: JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as RouteArtifacts["manifest"],
        contracts: JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as RouteArtifacts["contracts"],
    };
}

describe("GET and POST /activities/:application_id/test-mode", () => {
    test("declares the assigned manifest route ids", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/activities/:application_id/test-mode/", "api:http:POST:/activities/:application_id/test-mode/"]);
    });

    test("allows the application owner, team owner, and accepted developer/admin team members", () => {
        const application = {
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                members: [
                    { user_id: "developer", membership_state: TeamMemberState.ACCEPTED, role: TeamMemberRole.DEVELOPER },
                    { user_id: "admin", membership_state: TeamMemberState.ACCEPTED, role: TeamMemberRole.ADMIN },
                    { user_id: "read-only", membership_state: TeamMemberState.ACCEPTED, role: TeamMemberRole.READ_ONLY },
                    { user_id: "invited-developer", membership_state: TeamMemberState.INVITED, role: TeamMemberRole.DEVELOPER },
                ],
            },
        };

        assert.equal(canUseApplicationTestMode(application, "owner"), true);
        assert.equal(canUseApplicationTestMode(application, "team-owner"), true);
        assert.equal(canUseApplicationTestMode(application, "developer"), true);
        assert.equal(canUseApplicationTestMode(application, "admin"), true);
        assert.equal(canUseApplicationTestMode(application, "read-only"), false);
        assert.equal(canUseApplicationTestMode(application, "invited-developer"), false);
        assert.equal(canUseApplicationTestMode(application, "stranger"), false);
    });

    test("loads application owner and owning team members before returning empty test-mode success", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };

        await queryApplicationTestMode("application-id", "owner", { applicationRepository });
        await setApplicationTestMode("application-id", "owner", { applicationRepository });

        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "application-id" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 2);
    });

    test("throws unknown application before authorizing the caller", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        await assert.rejects(
            () => queryApplicationTestMode("missing-application", "owner", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
    });

    test("rejects users who cannot use the owning application test mode", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: {
                    owner_user_id: "team-owner",
                    members: [{ user_id: "read-only", membership_state: TeamMemberState.ACCEPTED, role: TeamMemberRole.READ_ONLY }],
                },
            })),
        };

        await assert.rejects(
            () => queryApplicationTestMode("application-id", "read-only", { applicationRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
    });

    test("returns mounted 204 responses for GET and POST without fabricating persistent state", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                owner: { id: "owner" },
                team: null,
            })),
        };
        const app = createApp({ applicationRepository });

        const getResponse = await request(app, "/activities/application-id/test-mode");
        const postResponse = await request(app, "/activities/application-id/test-mode", { method: "POST" });

        assert.equal(getResponse.status, 204);
        assert.equal(getResponse.text, "");
        assert.equal(postResponse.status, 204);
        assert.equal(postResponse.text, "");
        assert.equal(applicationRepository.findOne.mock.callCount(), 2);
    });

    test("returns mounted unknown application and authorization errors", async (t) => {
        const missingApplicationResponse = await request(
            createApp({
                applicationRepository: {
                    findOne: t.mock.fn(async (_options: unknown) => null),
                },
            }),
            "/activities/missing-application/test-mode",
        );
        assert.equal(missingApplicationResponse.status, 404);
        assert.deepEqual(missingApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });

        const unauthorizedResponse = await request(
            createApp(
                {
                    applicationRepository: {
                        findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" }, team: null })),
                    },
                },
                "intruder",
            ),
            "/activities/application-id/test-mode",
        );
        assert.equal(unauthorizedResponse.status, 400);
        assert.deepEqual(unauthorizedResponse.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/activities/:application_id/test-mode", createApplicationTestModeRouter(repositories()));
        app.use(ErrorHandler);

        const getResponse = await request(app, "/activities/application-id/test-mode");
        const postResponse = await request(app, "/activities/application-id/test-mode", { method: "POST" });

        assert.equal(getResponse.status, 401);
        assert.equal(postResponse.status, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/activities/application-id/test-mode"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/activities/application-id/test-mode"), false);
    });

    test("generates source catalog, OpenAPI, testing manifest, and contract metadata for the exact path", () => {
        const artifacts = loadRouteArtifacts();
        const sourceEntries = artifacts.sourceCatalog.filter((entry) => entry.route === "/activities/{application_id}/test-mode");
        assert.deepEqual(sourceEntries.map((entry) => entry.method).sort(), ["GET", "POST"]);
        for (const entry of sourceEntries) {
            assert.equal(entry.source, "src/api/routes/activities/#application_id/test-mode.ts");
            assert.deepEqual(entry.response_schema_refs, ["APIErrorResponse"]);
        }
        assert.equal(sourceEntries.find((entry) => entry.method === "GET")?.route_name, "GET_ACTIVITIES_APPLICATION_ID_TEST_MODE");
        assert.equal(sourceEntries.find((entry) => entry.method === "POST")?.route_name, "POST_ACTIVITIES_APPLICATION_ID_TEST_MODE");

        const path = artifacts.openapi.paths?.["/activities/{application_id}/test-mode/"];
        for (const method of ["get", "post"] as const) {
            const route = path?.[method];
            assert.deepEqual(route?.security, [{ bearer: [] }]);
            assert.equal(route?.responses?.["204"]?.content, undefined);
            assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
            assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
            assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }

        for (const manifestId of coveredManifestIds) {
            const manifestEntry = artifacts.manifest.entries?.find((entry) => entry.id === manifestId);
            assert.equal(manifestEntry?.authMode, "bearer");
            assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
            assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 404]);

            const contract = artifacts.contracts.contracts?.find((entry) => entry.manifestId === manifestId);
            assert.equal(contract?.authMode, "bearer");
            assert.equal(contract?.sourceFile, "src/api/routes/activities/#application_id/test-mode.ts");
            assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
            assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 400, 401, 404]);
        }
    });
});

async function request(app: express.Express, requestPath: string, init: RequestInit = {}) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
        const text = await response.text();
        const body = text ? (JSON.parse(text) as unknown) : undefined;

        return {
            status: response.status,
            body,
            text,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

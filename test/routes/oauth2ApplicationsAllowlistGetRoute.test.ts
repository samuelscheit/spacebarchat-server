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
import { describe, test, type TestContext } from "node:test";
import { ApplicationTesterState, TeamMemberRole, TeamMemberState } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createOAuth2ApplicationAllowlistRouter,
    getApplicationTesters,
    serializeApplicationTester,
    type ApplicationTesterListRepositories,
    type ApplicationTesterListRepository,
} from "../../src/api/routes/oauth2/applications/#application_id/allowlist";
import {
    canAccessApplicationTesters,
    requireApplicationTesterAccess,
    type ApplicationCommandAuthorizationRepository,
    type ApplicationCommandAuthorizationTarget,
} from "../../src/api/util/utility/ApplicationAuthorization";

type JsonSchema = {
    $ref?: string;
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const applicationId = "100000000000000001";
const missingApplicationId = "100000000000000002";
const firstUserId = "100000000000000003";
const secondUserId = "100000000000000004";
const routeSourceFile = "src/api/routes/oauth2/applications/#application_id/allowlist/index.ts";
const routePath = "/oauth2/applications/{application_id}/allowlist";
const manifestId = "api:http:GET:/oauth2/applications/:application_id/allowlist/";

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function createApplicationRepository(t: TestContext, application: ApplicationCommandAuthorizationTarget | null) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => application),
    } satisfies ApplicationCommandAuthorizationRepository;
}

function createTesterRepository(t: TestContext, testers: Awaited<ReturnType<ApplicationTesterListRepository["find"]>>) {
    return {
        find: t.mock.fn(async (_options: unknown) => testers),
    } satisfies ApplicationTesterListRepository;
}

function publicUser(id: string, username: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        username,
        discriminator: "0001",
        avatar: null,
        public_flags: 0,
        ...extra,
    };
}

function createApp(actorUserId: string, repositories: ApplicationTesterListRepositories) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = actorUserId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/oauth2/applications/:application_id/allowlist", createOAuth2ApplicationAllowlistRouter(repositories));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method?: string } = {}) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
            method: init.method,
        });
        const responseText = await response.text();
        const body = responseText ? (JSON.parse(responseText) as unknown) : undefined;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function isDiscordError(error: unknown, expected: { code: unknown }) {
    return (error as { code?: unknown })?.code === expected.code;
}

describe("GET /oauth2/applications/:application_id/allowlist", () => {
    test("declares authenticated GET metadata for listing application testers", () => {
        const routeSource = readFileSync(join(process.cwd(), routeSourceFile), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application Testers"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationTestersResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /204:\s*\{\}/);
    });

    test("returns stored testers for the application owner", async (t) => {
        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const testerRepository = createTesterRepository(t, [
            {
                state: ApplicationTesterState.INVITED,
                user: publicUser(firstUserId, "invited-tester", {
                    email: "hidden@example.invalid",
                    flags: 123,
                }),
            },
            {
                state: ApplicationTesterState.ACCEPTED,
                user: publicUser(secondUserId, "accepted-tester", {
                    bot: false,
                }),
            },
        ]);

        const response = await requestJson(createApp("owner", { applicationRepository, testerRepository }), `/oauth2/applications/${applicationId}/allowlist`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                user: {
                    id: firstUserId,
                    username: "invited-tester",
                    discriminator: "0001",
                    avatar: null,
                    public_flags: 0,
                },
                state: ApplicationTesterState.INVITED,
            },
            {
                user: {
                    id: secondUserId,
                    username: "accepted-tester",
                    discriminator: "0001",
                    avatar: null,
                    public_flags: 0,
                    bot: false,
                },
                state: ApplicationTesterState.ACCEPTED,
            },
        ]);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(testerRepository.find.mock.calls[0].arguments[0], {
            where: {
                application_id: applicationId,
            },
            relations: {
                user: true,
            },
            order: {
                user_id: "ASC",
            },
        });
    });

    test("allows accepted read-only team members to list testers", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        });
        const testerRepository = createTesterRepository(t, []);

        assert.deepEqual(await getApplicationTesters(applicationId, "read-only", { applicationRepository, testerRepository }), []);
        assert.equal(testerRepository.find.mock.callCount(), 1);
    });

    test("returns 403 before querying testers for non-team callers", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        });
        const testerRepository = createTesterRepository(t, []);

        const response = await requestJson(createApp("invited", { applicationRepository, testerRepository }), `/oauth2/applications/${applicationId}/allowlist`);

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(testerRepository.find.mock.callCount(), 0);
    });

    test("returns 404 for unknown or malformed applications", async (t) => {
        const missingApplicationRepository = createApplicationRepository(t, null);
        const testerRepository = createTesterRepository(t, []);
        const missingApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository: missingApplicationRepository, testerRepository }),
            `/oauth2/applications/${missingApplicationId}/allowlist`,
        );

        const malformedApplicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const malformedApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository: malformedApplicationRepository, testerRepository }),
            "/oauth2/applications/not-a-snowflake/allowlist",
        );

        assert.equal(missingApplicationResponse.status, 404);
        assert.deepEqual(missingApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(malformedApplicationResponse.status, 404);
        assert.deepEqual(malformedApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(malformedApplicationRepository.findOne.mock.callCount(), 0);
        assert.equal(testerRepository.find.mock.callCount(), 0);
    });

    test("serializes tester users as partial users", () => {
        assert.deepEqual(
            serializeApplicationTester({
                state: ApplicationTesterState.ACCEPTED,
                user: publicUser(firstUserId, "tester", {
                    email: "private@example.invalid",
                    avatar: undefined,
                    flags: 64,
                    banner: "banner-hash",
                }),
            }),
            {
                user: {
                    id: firstUserId,
                    username: "tester",
                    discriminator: "0001",
                    avatar: null,
                    banner: "banner-hash",
                    public_flags: 0,
                },
                state: ApplicationTesterState.ACCEPTED,
            },
        );
    });
});

describe("application tester read authorization", () => {
    test("allows owners, team owners, and accepted team members", async (t) => {
        const application = {
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                members: [
                    {
                        user_id: "admin",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.ADMIN,
                    },
                    {
                        user_id: "read-only",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        };
        const repository = createApplicationRepository(t, application);

        assert.equal(canAccessApplicationTesters(application, "owner"), true);
        assert.equal(canAccessApplicationTesters(application, "team-owner"), true);
        assert.equal(canAccessApplicationTesters(application, "admin"), true);
        assert.equal(canAccessApplicationTesters(application, "read-only"), true);
        await requireApplicationTesterAccess("app", "read-only", repository);
    });

    test("rejects bot users, invited members, strangers, and unknown applications", async (t) => {
        const application = {
            owner: { id: "owner" },
            bot: { id: "application" },
            team: {
                members: [
                    {
                        user_id: "invited",
                        membership_state: TeamMemberState.INVITED,
                        role: TeamMemberRole.ADMIN,
                    },
                ],
            },
        };

        assert.equal(canAccessApplicationTesters(application, "application"), false);
        assert.equal(canAccessApplicationTesters(application, "invited"), false);
        assert.equal(canAccessApplicationTesters(application, "stranger"), false);
        await assert.rejects(
            () => requireApplicationTesterAccess("app", "stranger", createApplicationRepository(t, application)),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
        await assert.rejects(
            () => requireApplicationTesterAccess("missing", "owner", createApplicationRepository(t, null)),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
    });
});

describe("GET /oauth2/applications/:application_id/allowlist generated artifacts", () => {
    test("generates response schema, source catalog, OpenAPI, manifest, contract, coverage, and missing-route metadata", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        const responseSchema = schemas.ApplicationTestersResponse;
        assert.equal(responseSchema.type, "array");
        assert.equal(responseSchema.items?.$ref, "#/definitions/ApplicationTesterResponse");

        const testerSchema = schemas.ApplicationTesterResponse;
        assert.deepEqual(testerSchema.required?.sort(), ["state", "user"]);
        assert.equal(testerSchema.properties?.user?.$ref, "#/definitions/PartialUser");
        assert.equal(testerSchema.properties?.state?.$ref, "#/definitions/ApplicationTesterState");
        assert.deepEqual(schemas.ApplicationTesterState.enum, [1, 2]);

        const route = openapi.paths?.["/oauth2/applications/{application_id}/allowlist/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationTestersResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === routePath);
        assert.equal(sourceEntry?.route_name, "GET_OAUTH2_APPLICATIONS_APPLICATION_ID_ALLOWLIST");
        assert.equal(sourceEntry?.source, routeSourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationTestersResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, routeSourceFile);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationTestersResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, routeSourceFile);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationTestersResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);
        assert.ok(JSON.stringify(suiteCoverage).includes(manifestId));

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" && entry.route === "/oauth2/applications/{param}/allowlist" && entry.route_name === "GET_OAUTH2_APPLICATIONS_APPLICATION_ID_ALLOWLIST",
            ),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "POST" && entry.route === "/oauth2/applications/{param}/allowlist" && entry.route_name === "POST_OAUTH2_APPLICATIONS_APPLICATION_ID_ALLOWLIST",
            ),
            true,
        );
    });
});

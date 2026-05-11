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
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    DEFAULT_APPLICATION_DISCOVERABILITY_STATE,
    DEFAULT_APPLICATION_DISCOVERY_ELIGIBILITY_FLAGS,
    buildApplicationDiscoverabilityStateResponse,
    createApplicationDiscoverabilityStateRouter,
    getApplicationDiscoverabilityStateResponse,
    type ApplicationDiscoverabilityStateRepositories,
} from "../../src/api/routes/applications/#application_id/discoverability-state";
import { canAccessApplicationGiftCodeBatches } from "../../src/api/util/utility/ApplicationAuthorization";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { ApplicationCommandHandlerType, ApplicationCommandType } from "../../src/schemas/api/bots/ApplicationCommandSchema";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import { DiscordApiErrors } from "../../src/util";
import type { ApplicationCommand } from "../../src/util/entities/ApplicationCommand";

const coveredManifestIds = ["api:http:GET:/applications/:application_id/discoverability-state/"];

type JsonSchema = {
    anyOf?: JsonSchema[];
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
    $ref?: string;
};

function makeApplication(overrides: Record<string, unknown> = {}) {
    return {
        discoverability_state: 2,
        discovery_eligibility_flags: 2560,
        owner: { id: "owner" },
        team: null,
        ...overrides,
    };
}

function makeCommand(overrides: Partial<ApplicationCommand> = {}): ApplicationCommand {
    return {
        id: "command-a",
        application_id: "application-id",
        name: "launch",
        description: "Launch the activity.",
        options: [],
        default_member_permissions: null,
        dm_permission: true,
        nsfw: true,
        global_popularity_rank: 1,
        type: ApplicationCommandType.CHAT_INPUT,
        version: "command-version",
        handler: ApplicationCommandHandlerType.APP_HANDLER,
        ...overrides,
    } as ApplicationCommand;
}

function createApp(repositories: ApplicationDiscoverabilityStateRepositories, userId = "owner") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/discoverability-state", createApplicationDiscoverabilityStateRouter(repositories));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/applications/:application_id/discoverability-state", createApplicationDiscoverabilityStateRouter());
    app.use(ErrorHandler);
    return app;
}

function propertyTypes(schema: JsonSchema) {
    if (Array.isArray(schema.type)) return schema.type.toSorted();
    if (typeof schema.type === "string") return [schema.type];
    return [];
}

function isDiscordError(error: unknown, expected: typeof DiscordApiErrors.UNKNOWN_APPLICATION) {
    return (error as { code?: unknown; message?: unknown })?.code === expected.code && (error as { code?: unknown; message?: unknown })?.message === expected.message;
}

describe("GET /applications/:application_id/discoverability-state", () => {
    test("loads the application owner/team and source-backed discoverability fields", async (t) => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/:application_id/discoverability-state/"]);
        const command = makeCommand();
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => makeApplication()),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => [command]),
        };

        const response = await getApplicationDiscoverabilityStateResponse("application-id", "owner", { applicationRepository, commandRepository });

        assert.equal(response.discoverability_state, 2);
        assert.equal(response.discovery_eligibility_flags, 2560);
        assert.deepEqual(JSON.parse(JSON.stringify(response.bad_commands)), [
            {
                id: "command-a",
                type: ApplicationCommandType.CHAT_INPUT,
                application_id: "application-id",
                name: "launch",
                description: "Launch the activity.",
                options: [],
                default_member_permissions: null,
                dm_permission: true,
                nsfw: true,
                global_popularity_rank: 1,
                version: "command-version",
                handler: ApplicationCommandHandlerType.APP_HANDLER,
            },
        ]);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: "application-id" },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });

        const commandFindOptions = commandRepository.find.mock.calls[0].arguments[0] as {
            order?: Record<string, unknown>;
            where?: Record<string, unknown>;
        };
        assert.equal(commandFindOptions.where?.application_id, "application-id");
        assert.equal(commandFindOptions.where?.nsfw, true);
        assert.ok(commandFindOptions.where?.guild_id, "expected the bad-command query to stay scoped to global commands");
        assert.deepEqual(commandFindOptions.order, { name: "ASC", id: "ASC" });
    });

    test("allows application owners, team owners, and accepted owning-team members", () => {
        assert.equal(canAccessApplicationGiftCodeBatches({ owner: { id: "owner" } }, "owner"), true);
        assert.equal(
            canAccessApplicationGiftCodeBatches(
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
            canAccessApplicationGiftCodeBatches(
                {
                    owner: { id: "owner" },
                    team: {
                        members: [
                            {
                                user_id: "accepted-member",
                                membership_state: TeamMemberState.ACCEPTED,
                                role: TeamMemberRole.DEVELOPER,
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
            canAccessApplicationGiftCodeBatches(
                {
                    owner: { id: "owner" },
                    team: {
                        owner_user_id: "team-owner",
                        members: [
                            {
                                user_id: "invited-member",
                                membership_state: TeamMemberState.INVITED,
                                role: TeamMemberRole.DEVELOPER,
                            },
                        ],
                    },
                },
                "invited-member",
            ),
            false,
        );

        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => makeApplication()),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        await assert.rejects(
            () => getApplicationDiscoverabilityStateResponse("application-id", "intruder", { applicationRepository, commandRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION),
        );
        assert.equal(commandRepository.find.mock.calls.length, 0);
    });

    test("throws unknown application before checking bad commands", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        await assert.rejects(
            () => getApplicationDiscoverabilityStateResponse("missing-application", "owner", { applicationRepository, commandRepository }),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );
        assert.equal(commandRepository.find.mock.calls.length, 0);
    });

    test("uses local defaults and does not invent bad command review records", () => {
        const response = buildApplicationDiscoverabilityStateResponse(
            makeApplication({
                discoverability_state: null,
                discovery_eligibility_flags: null,
            }),
            [],
        );

        assert.deepEqual(response, {
            discoverability_state: DEFAULT_APPLICATION_DISCOVERABILITY_STATE,
            discovery_eligibility_flags: DEFAULT_APPLICATION_DISCOVERY_ELIGIBILITY_FLAGS,
            bad_commands: [],
        });
    });

    test("returns the mounted route response for an application owner", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => makeApplication()),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => [makeCommand()]),
        };

        const response = await requestJson(createApp({ applicationRepository, commandRepository }), "/applications/application-id/discoverability-state");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            discoverability_state: 2,
            discovery_eligibility_flags: 2560,
            bad_commands: [
                {
                    id: "command-a",
                    type: ApplicationCommandType.CHAT_INPUT,
                    application_id: "application-id",
                    name: "launch",
                    description: "Launch the activity.",
                    options: [],
                    default_member_permissions: null,
                    dm_permission: true,
                    nsfw: true,
                    global_popularity_rank: 1,
                    version: "command-version",
                    handler: ApplicationCommandHandlerType.APP_HANDLER,
                },
            ],
        });
    });

    test("returns the mounted route unknown application response", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        const response = await requestJson(createApp({ applicationRepository, commandRepository }), "/applications/missing-application/discoverability-state");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("returns the mounted route authorization response for non-team callers", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => makeApplication()),
        };
        const commandRepository = {
            find: t.mock.fn(async (_options: unknown) => []),
        };

        const response = await requestJson(createApp({ applicationRepository, commandRepository }, "intruder"), "/applications/application-id/discoverability-state");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("stays behind bearer auth and only owns the exact discoverability-state path", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/applications/application-id/discoverability-state"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/applications/application-id/discoverability-state/"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/applications/application-id/rpc"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/applications/application-id/disclosures"), false);

        const response = await requestJson(createAuthenticatedApp(), "/applications/application-id/discoverability-state");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("documents authenticated route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "discoverability-state.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Application Discoverability State"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationDiscoverabilityStateResponse"/s);
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

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/applications/{application_id}/discoverability-state");
        assert.equal(sourceEntry?.route_name, "GET_APPLICATIONS_APPLICATION_ID_DISCOVERABILITY_STATE");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/#application_id/discoverability-state.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationDiscoverabilityStateResponse"]);

        const route = openapi.paths?.["/applications/{application_id}/discoverability-state/"]?.get;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDiscoverabilityStateResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const responseSchema = schemas.ApplicationDiscoverabilityStateResponse;
        assert.deepEqual(propertyTypes(responseSchema.properties?.discoverability_state ?? {}), ["integer"]);
        assert.deepEqual(propertyTypes(responseSchema.properties?.discovery_eligibility_flags ?? {}), ["integer"]);
        assert.deepEqual(propertyTypes(responseSchema.properties?.bad_commands ?? {}), ["array"]);
        assert.equal(responseSchema.properties?.bad_commands?.items?.$ref, "#/definitions/ApplicationCommandSchema");
        assert.deepEqual(responseSchema.required, ["bad_commands", "discoverability_state", "discovery_eligibility_flags"]);
        assert.equal(openapi.components?.schemas?.ApplicationDiscoverabilityStateResponse?.properties?.bad_commands?.items?.$ref, "#/components/schemas/ApplicationCommandSchema");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "ApplicationDiscoverabilityStateResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "ApplicationDiscoverabilityStateResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
    });
});

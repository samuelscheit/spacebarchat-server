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
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { ActivityType, type Activity } from "@spacebar/util";
import express from "express";
import type { ActivitySecretDependencies, ActivitySecretSession, ActivitySecretVoiceState } from "./#activity_action_type";

const requireModule = require;
const routeModulePath = require.resolve("./#activity_action_type");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/:user_id/sessions/:session_id/activities/:application_id/:activity_action_type", () => {
    test("declares authenticated activity-secret route metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get Activity Secret",
            description:
                "Returns a locally persisted join or spectate activity secret when the target session, activity flags, and locally verifiable party privacy rules allow access.",
            query: {
                channel_id: {
                    type: "string",
                    description: "The channel ID of a rich presence invite message.",
                },
                message_id: {
                    type: "string",
                    description: "The message ID of a rich presence invite message.",
                },
            },
            responses: {
                200: {
                    body: "ActivitySecretResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns the current user's stored join and spectate secrets without relationship lookups", async () => {
        const { ActivitySecretFlags, getActivitySecretResponse } = loadRouteModule();
        const harness = createDependencies({
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN, ActivitySecretFlags.SPECTATE),
                        secrets: {
                            join: "join-secret",
                            spectate: "spectate-secret",
                        },
                    }),
                ],
            }),
        });

        assert.deepEqual(await getActivitySecretResponse("target", "target", "session", "application", "1", harness.dependencies), { secret: "join-secret" });
        assert.deepEqual(await getActivitySecretResponse("target", "target", "session", "application", "2", harness.dependencies), { secret: "spectate-secret" });
        assert.deepEqual(harness.calls.countFriendRelationship, []);
        assert.deepEqual(harness.calls.findVoiceStates, []);
    });

    test("allows friend access only when the stored activity exposes friend party privacy", async () => {
        const { ActivitySecretFlags, ACTIVITY_SECRET_MISSING_ACCESS, getActivitySecretResponse } = loadRouteModule();

        const privateParty = createDependencies({
            relationshipCount: 1,
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN),
                    }),
                ],
            }),
        });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", privateParty.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );

        const friendParty = createDependencies({
            relationshipCount: 1,
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN, ActivitySecretFlags.PARTY_PRIVACY_FRIENDS),
                    }),
                ],
            }),
        });

        assert.deepEqual(await getActivitySecretResponse("viewer", "target", "session", "application", "1", friendParty.dependencies), { secret: "join-secret" });
    });

    test("allows same-voice access only when the stored activity exposes voice-channel party privacy", async () => {
        const { ActivitySecretFlags, getActivitySecretResponse } = loadRouteModule();
        const harness = createDependencies({
            relationshipCount: 0,
            voiceStates: [
                { user_id: "viewer", channel_id: "voice-channel" },
                { user_id: "target", channel_id: "voice-channel" },
            ],
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN, ActivitySecretFlags.PARTY_PRIVACY_VOICE_CHANNEL),
                    }),
                ],
            }),
        });

        assert.deepEqual(await getActivitySecretResponse("viewer", "target", "session", "application", "1", harness.dependencies), { secret: "join-secret" });
    });

    test("fails closed before session lookup for unrelated users without a shared persisted voice channel", async () => {
        const { ACTIVITY_SECRET_MISSING_ACCESS, getActivitySecretResponse } = loadRouteModule();
        const harness = createDependencies({
            relationshipCount: 0,
            voiceStates: [
                { user_id: "viewer", channel_id: "viewer-voice" },
                { user_id: "target", channel_id: "target-voice" },
            ],
        });

        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", harness.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );
        assert.deepEqual(harness.calls.findSession, []);
    });

    test("rejects missing sessions, invisible sessions, unsupported actions, missing flags, and absent secrets", async () => {
        const { ActivitySecretFlags, ACTIVITY_SECRET_MISSING_ACCESS, ACTIVITY_SECRET_UNKNOWN_SESSION, getActivitySecretResponse } = loadRouteModule();

        const missingSession = createDependencies({ relationshipCount: 1, session: null });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", missingSession.dependencies),
            (error) => error === ACTIVITY_SECRET_UNKNOWN_SESSION,
        );

        const invisibleSession = createDependencies({
            relationshipCount: 1,
            session: createSession({ status: "invisible" }),
        });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", invisibleSession.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );

        const unsupportedAction = createDependencies({ relationshipCount: 1 });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "3", unsupportedAction.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );

        const missingJoinFlag = createDependencies({
            relationshipCount: 1,
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.PARTY_PRIVACY_FRIENDS),
                    }),
                ],
            }),
        });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", missingJoinFlag.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );

        const missingSecret = createDependencies({
            relationshipCount: 1,
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN, ActivitySecretFlags.PARTY_PRIVACY_FRIENDS),
                        secrets: {},
                    }),
                ],
            }),
        });
        await assert.rejects(
            () => getActivitySecretResponse("viewer", "target", "session", "application", "1", missingSecret.dependencies),
            (error) => error === ACTIVITY_SECRET_MISSING_ACCESS,
        );
    });

    test("serves the route through Express using persisted session and relationship records", async (t) => {
        const { ActivitySecretFlags } = loadRouteModule();
        const harness = setupActivitySecretRoute(t, {
            relationshipCount: 1,
            session: createSession({
                activities: [
                    createActivity({
                        flags: flagValue(ActivitySecretFlags.JOIN, ActivitySecretFlags.PARTY_PRIVACY_FRIENDS),
                    }),
                ],
            }),
        });

        const response = await requestJson(harness.app, "/users/target/sessions/session/activities/application/1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { secret: "join-secret" });
        assert.deepEqual(harness.findSessionOptions[0], {
            where: {
                user_id: "target",
                session_id: "session",
                is_admin_session: false,
            },
            select: {
                user_id: true,
                session_id: true,
                status: true,
                activities: true,
            },
        });
    });

    test("generated artifacts own only the exact source-backed GET activity-secret path", () => {
        const routeSource = readFileSync(
            path.join(process.cwd(), "src", "api", "routes", "users", "#user_id", "sessions", "#session_id", "activities", "#application_id", "#activity_action_type.ts"),
            "utf8",
        );
        const schemas = readJson<Record<string, { properties?: Record<string, { type?: unknown }>; required?: string[] }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
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
        }>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<{ contracts?: { manifestId?: string; sourceFile?: string; routeMetadata?: { responses?: string[] } }[] }>(
            path.join("test", "generated", "http-contracts.json"),
        );

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"ActivitySecretResponse"/);
        assert.match(routeSource, /403:\s*{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.ActivitySecretResponse?.properties?.secret?.type, "string");
        assert.equal(schemas.ActivitySecretResponse?.required?.includes("secret"), true);

        const openapiRoute = openapi.paths?.["/users/{user_id}/sessions/{session_id}/activities/{application_id}/{activity_action_type}/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivitySecretResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find(
            (entry) => entry.method === "GET" && entry.route === "/users/{user_id}/sessions/{session_id}/activities/{application_id}/{activity_action_type}",
        );
        assert.equal(sourceRoute?.route_name, "GET_USERS_USER_ID_SESSIONS_SESSION_ID_ACTIVITIES_APPLICATION_ID_ACTIVITY_ACTION_TYPE");
        assert.equal(sourceRoute?.source, "src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("ActivitySecretResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/{param}/sessions/{param}/activities/{param}/{param}"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/{param}/sessions/{param}/activities/{param}/1"),
            true,
        );

        const manifestId = "api:http:GET:/users/:user_id/sessions/:session_id/activities/:application_id/:activity_action_type/";
        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ActivitySecretResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/#activity_action_type.ts");
        assert.equal(contractEntry?.routeMetadata?.responses?.includes("ActivitySecretResponse"), true);
    });
});

function loadRouteModule(): typeof import("./#activity_action_type") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./#activity_action_type");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as {
        route: (routeOption: unknown) => express.RequestHandler;
    };
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    loadRouteModule();

    return routeOptions;
}

type DependencyCalls = {
    findSession: { userId: string; sessionId: string }[];
    countFriendRelationship: { fromUserId: string; toUserId: string }[];
    findVoiceStates: { requesterId: string; targetUserId: string }[];
};

type DependencyOptions = {
    relationshipCount?: number;
    session?: ActivitySecretSession | null;
    voiceStates?: ActivitySecretVoiceState[];
};

function createDependencies(options: DependencyOptions = {}) {
    const calls: DependencyCalls = {
        findSession: [],
        countFriendRelationship: [],
        findVoiceStates: [],
    };

    const dependencies: ActivitySecretDependencies = {
        findSession: async (userId, sessionId) => {
            calls.findSession.push({ userId, sessionId });
            return options.session === undefined ? createSession() : options.session;
        },
        countFriendRelationship: async (fromUserId, toUserId) => {
            calls.countFriendRelationship.push({ fromUserId, toUserId });
            return options.relationshipCount ?? 1;
        },
        findVoiceStates: async (requesterId, targetUserId) => {
            calls.findVoiceStates.push({ requesterId, targetUserId });
            return options.voiceStates ?? [];
        },
    };

    return { calls, dependencies };
}

type RouteSetupOptions = DependencyOptions & {
    userId?: string;
};

function setupActivitySecretRoute(t: TestContext, options: RouteSetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as {
        route: (routeOption: unknown) => express.RequestHandler;
    };
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../../../../middlewares/ErrorHandler");
    const utilModule = requireModule(distModulePath("util", "index.js")) as typeof import("@spacebar/util");
    const findSessionOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
    t.mock.method(utilModule.Session, "findOne", async (findOptions: unknown) => {
        findSessionOptions.push(findOptions);
        return options.session === undefined ? createSession() : options.session;
    });
    t.mock.method(utilModule.Relationship, "count", async () => options.relationshipCount ?? 1);
    t.mock.method(utilModule.VoiceState, "find", async () => options.voiceStates ?? []);

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./#activity_action_type")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/users/:user_id/sessions/:session_id/activities/:application_id/:activity_action_type", router);
    app.use(errorHandlerModule.ErrorHandler);

    return { app, findSessionOptions };
}

function createActivity(overrides: Partial<Activity> = {}): Activity {
    return {
        name: "Game",
        type: ActivityType.GAME,
        application_id: "application",
        flags: "0",
        secrets: {
            join: "join-secret",
        },
        ...overrides,
    };
}

function createSession(overrides: Partial<ActivitySecretSession> = {}): ActivitySecretSession {
    return {
        user_id: "target",
        session_id: "session",
        status: "online",
        activities: [createActivity()],
        ...overrides,
    };
}

function flagValue(...flags: number[]) {
    return String(flags.reduce((sum, flag) => sum | flag, 0));
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

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

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

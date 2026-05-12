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
import { ChannelType } from "@spacebar/schemas";
import { ActivityType, ApplicationFlags, DiscordApiErrors, type Activity } from "@spacebar/util";
import express from "express";
import {
    ACTIVITY_LAUNCH_MISSING_ACCESS,
    ACTIVITY_LAUNCH_UNKNOWN_SESSION,
    createActivityLaunchRouter,
    findExistingLaunchPartyId,
    isEmbeddedActivityApplication,
    isSupportedActivityLaunchChannel,
    launchEmbeddedActivity,
    upsertEmbeddedActivityLaunch,
    type ActivityLaunchDependencies,
    type ActivityLaunchPermissionLike,
    type ActivityLaunchSession,
} from "../../src/api/routes/activities/#channel_id/#application_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:POST:/activities/:channel_id/:application_id/";
const sourceRoute = "/activities/{channel_id}/{application_id}";
const assignedMissingRoute = "/activities/{param}/{param}";

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
                    requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
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
                requestBody?: string;
                responseBodies?: string[];
                responseStatuses?: number[];
            };
            sourceFile?: string;
        }[];
    };
    contracts: {
        contracts?: {
            authMode?: string;
            manifestId?: string;
            routeMetadata?: {
                requestBody?: string;
                responses?: string[];
                responseStatuses?: number[];
            };
            sourceFile?: string;
        }[];
    };
    missingRoutes: {
        missing_entries: {
            method: string;
            route: string;
            route_name?: string;
        }[];
    };
    schemas: Record<string, { properties?: Record<string, JsonSchema & { minLength?: number; type?: string }>; required?: string[]; type?: string }>;
};

function embeddedApplication(overrides: Partial<Awaited<ReturnType<ActivityLaunchDependencies["findApplication"]>>> = {}) {
    return {
        id: "application-id",
        name: "Poker Night",
        flags: Number(ApplicationFlags.FLAGS.EMBEDDED),
        guild_id: "guild-id",
        bot: { id: "bot-user-id" },
        ...overrides,
    };
}

function voiceSession(overrides: Partial<ActivityLaunchSession> = {}): ActivityLaunchSession {
    return {
        user_id: "user-id",
        session_id: "session-id",
        status: "online",
        activities: [],
        client_status: { web: "online" },
        ...overrides,
    };
}

function activity(applicationId: string, partyId?: string): Activity {
    return {
        application_id: applicationId,
        name: "Embedded Activity",
        type: ActivityType.GAME,
        party: partyId ? { id: partyId } : undefined,
    };
}

function permissions(grantedPermissions: string[]): ActivityLaunchPermissionLike {
    const granted = new Set(grantedPermissions);
    return {
        has: (permission) => granted.has(permission),
    };
}

function dependencies(overrides: Partial<ActivityLaunchDependencies> = {}): ActivityLaunchDependencies {
    return {
        findApplication: async () => embeddedApplication(),
        findChannel: async () => ({ id: "channel-id", guild_id: "guild-id", type: ChannelType.GUILD_VOICE }),
        isApplicationAuthorizedForGuild: async () => true,
        getPermission: async () => permissions(["VIEW_CHANNEL", "CONNECT", "USE_EMBEDDED_ACTIVITIES", "USE_EXTERNAL_APPS"]),
        findSession: async () => voiceSession(),
        findVoiceState: async (userId, sessionId, channelId) => ({ user_id: userId, session_id: sessionId, channel_id: channelId, guild_id: "guild-id" }),
        findVoiceStates: async () => [{ user_id: "user-id", session_id: "session-id", channel_id: "channel-id", guild_id: "guild-id" }],
        findSessionsForVoiceStates: async () => [],
        saveSessionActivities: async () => undefined,
        emitPresenceUpdate: async () => undefined,
        createLaunchPartyId: () => "generated-party-id",
        now: () => 123456789,
        ...overrides,
    };
}

function isDiscordError(error: unknown, expected: { code: number; message: string }) {
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
        missingRoutes: JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as RouteArtifacts["missingRoutes"],
        schemas: JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as RouteArtifacts["schemas"],
    };
}

describe("POST /activities/:channel_id/:application_id", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:POST:/activities/:channel_id/:application_id/");
    });

    test("models embedded application and supported launch-channel checks", () => {
        assert.equal(isEmbeddedActivityApplication(embeddedApplication()), true);
        assert.equal(isEmbeddedActivityApplication(embeddedApplication({ flags: 0 })), false);
        assert.equal(isSupportedActivityLaunchChannel({ id: "voice", guild_id: "guild", type: ChannelType.GUILD_VOICE }), true);
        assert.equal(isSupportedActivityLaunchChannel({ id: "dm", guild_id: undefined, type: ChannelType.DM }), true);
        assert.equal(isSupportedActivityLaunchChannel({ id: "text", guild_id: "guild", type: ChannelType.GUILD_TEXT }), false);
    });

    test("uses the caller's current party before joining another local channel instance", () => {
        const session = voiceSession({ activities: [activity("application-id", "current-party")] });
        const otherSession = voiceSession({
            user_id: "other-user",
            session_id: "other-session",
            activities: [activity("application-id", "other-party")],
        });

        assert.equal(findExistingLaunchPartyId("application-id", session, [otherSession]), "current-party");
        assert.equal(findExistingLaunchPartyId("other-application-id", session, [otherSession]), undefined);
    });

    test("upserts a locally persisted embedded activity presence without discarding other activities", () => {
        const existingActivity: Activity = {
            ...activity("application-id", "old-party"),
            details: "preserved details",
            created_at: 1,
        };

        const activities = upsertEmbeddedActivityLaunch([activity("other-application-id"), existingActivity], embeddedApplication(), "session-id", "new-party", 999);

        assert.deepEqual(activities, [
            activity("other-application-id"),
            {
                ...existingActivity,
                application_id: "application-id",
                created_at: 1,
                instance: true,
                session_id: "session-id",
                party: { id: "new-party" },
            },
        ]);
    });

    test("rejects unknown, non-embedded, unsupported-channel, and unjoined launch targets", async () => {
        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "missing", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({ findApplication: async () => null }),
                ),
            (error) => isDiscordError(error, DiscordApiErrors.UNKNOWN_APPLICATION),
        );

        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({ findApplication: async () => embeddedApplication({ flags: 0 }) }),
                ),
            (error) => error === ACTIVITY_LAUNCH_MISSING_ACCESS,
        );

        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({ findChannel: async () => ({ id: "channel-id", guild_id: "guild-id", type: ChannelType.GUILD_TEXT }) }),
                ),
            (error) => isDiscordError(error, DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE),
        );

        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "missing-session" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({ findSession: async () => null }),
                ),
            (error) => error === ACTIVITY_LAUNCH_UNKNOWN_SESSION,
        );

        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({ findVoiceState: async () => null }),
                ),
            (error) => isDiscordError(error, DiscordApiErrors.TARGET_USER_IS_NOT_CONNECTED_TO_VOICE),
        );
    });

    test("requires embedded activity permissions and external app permission without local guild authorization", async () => {
        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({
                        getPermission: async () => permissions(["VIEW_CHANNEL", "CONNECT"]),
                    }),
                ),
            (error) => isDiscordError(error, DiscordApiErrors.MISSING_PERMISSIONS.withParams("USE_EMBEDDED_ACTIVITIES")),
        );

        await assert.rejects(
            () =>
                launchEmbeddedActivity(
                    { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
                    dependencies({
                        isApplicationAuthorizedForGuild: async () => false,
                        getPermission: async () => permissions(["VIEW_CHANNEL", "CONNECT", "USE_EMBEDDED_ACTIVITIES"]),
                    }),
                ),
            (error) => isDiscordError(error, DiscordApiErrors.MISSING_PERMISSIONS.withParams("USE_EXTERNAL_APPS")),
        );
    });

    test("joins an existing local channel activity instance and emits updated presence", async () => {
        const savedActivities: Activity[][] = [];
        const emittedSessions: ActivityLaunchSession[] = [];

        await launchEmbeddedActivity(
            { applicationId: "application-id", body: { session_id: "session-id" }, channelId: "channel-id", userId: "user-id" },
            dependencies({
                findVoiceStates: async () => [
                    { user_id: "user-id", session_id: "session-id", channel_id: "channel-id", guild_id: "guild-id" },
                    { user_id: "other-user", session_id: "other-session", channel_id: "channel-id", guild_id: "guild-id" },
                ],
                findSessionsForVoiceStates: async () => [
                    voiceSession({
                        user_id: "other-user",
                        session_id: "other-session",
                        activities: [activity("application-id", "existing-party")],
                    }),
                ],
                saveSessionActivities: async (_userId, _sessionId, activities) => {
                    savedActivities.push(activities);
                },
                emitPresenceUpdate: async (_userId, session) => {
                    emittedSessions.push(session);
                },
            }),
        );

        assert.deepEqual(savedActivities, [
            [
                {
                    name: "Poker Night",
                    type: ActivityType.GAME,
                    created_at: 123456789,
                    application_id: "application-id",
                    instance: true,
                    session_id: "session-id",
                    party: { id: "existing-party" },
                },
            ],
        ]);
        assert.deepEqual(
            emittedSessions.map((session) => session.activities),
            savedActivities,
        );
    });

    test("returns mounted 204 responses and remains behind bearer authentication", async () => {
        const savedActivities: Activity[][] = [];
        const app = createRouteApp(
            dependencies({
                saveSessionActivities: async (_userId, _sessionId, activities) => {
                    savedActivities.push(activities);
                },
            }),
        );

        const response = await request(app, "/activities/channel-id/application-id", {
            method: "POST",
            body: JSON.stringify({ session_id: "session-id" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.equal(savedActivities.length, 1);

        const authenticatedApp = express();
        authenticatedApp.use(express.json());
        authenticatedApp.use(Authentication);
        authenticatedApp.use("/activities/:channel_id/:application_id", createActivityLaunchRouter(dependencies()));
        authenticatedApp.use(ErrorHandler);

        const unauthenticatedResponse = await request(authenticatedApp, "/activities/channel-id/application-id", {
            method: "POST",
            body: JSON.stringify({ session_id: "session-id" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(unauthenticatedResponse.status, 401);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/activities/channel-id/application-id"), false);
    });

    test("validates request bodies through the route schema", async () => {
        const response = await request(createRouteApp(dependencies()), "/activities/channel-id/application-id", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
    });

    test("generates source catalog, OpenAPI, testing manifest, contracts, and missing-route movement for the exact path", () => {
        const artifacts = loadRouteArtifacts();
        const sourceEntry = artifacts.sourceCatalog.find((entry) => entry.method === "POST" && entry.route === sourceRoute);
        assert.equal(sourceEntry?.route_name, "POST_ACTIVITIES_CHANNEL_ID_APPLICATION_ID");
        assert.equal(sourceEntry?.source, "src/api/routes/activities/#channel_id/#application_id.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        const schema = artifacts.schemas.ActivityLaunchSchema;
        assert.equal(schema?.type, "object");
        assert.deepEqual(schema?.required, ["session_id"]);
        assert.equal(schema?.properties?.session_id?.type, "string");
        assert.equal(schema?.properties?.session_id?.minLength, 1);

        const route = artifacts.openapi.paths?.["/activities/{channel_id}/{application_id}/"]?.post;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivityLaunchSchema");
        assert.equal(route?.responses?.["204"]?.content, undefined);
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const manifestEntry = artifacts.manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/activities/#channel_id/#application_id.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "ActivityLaunchSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 403, 404]);

        const contract = artifacts.contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, "src/api/routes/activities/#channel_id/#application_id.ts");
        assert.equal(contract?.routeMetadata?.requestBody, "ActivityLaunchSchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 400, 401, 403, 404]);

        assert.equal(
            artifacts.missingRoutes.missing_entries.some(
                (entry) => entry.method === "POST" && entry.route === assignedMissingRoute && entry.route_name === "POST_ACTIVITIES_CHANNEL_ID_APPLICATION_ID",
            ),
            false,
        );
    });
});

function createRouteApp(routeDependencies: ActivityLaunchDependencies) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/activities/:channel_id/:application_id", createActivityLaunchRouter(routeDependencies));
    app.use(ErrorHandler);
    return app;
}

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

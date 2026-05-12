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
import { afterEach, describe, test, type TestContext } from "node:test";
import type { PublicUser } from "@spacebar/schemas";
import type { Activity } from "@spacebar/util";
import express from "express";
import type { EmbeddedActivityLeaveDependencies, EmbeddedActivityLeaveSession, EmbeddedActivityLeaveVoiceState } from "./leave";

const requireModule = require;
const routeModulePath = require.resolve("./leave");
const manifestId = "api:http:POST:/applications/:application_id/activities/:instance_location_id/instances/:instance_instance_id/leave/";
const sourceFile = "src/api/routes/applications/#application_id/activities/#instance_location_id/instances/#instance_instance_id/leave.ts";
const sourceRoute = "/applications/{application_id}/activities/{instance_location_id}/instances/{instance_instance_id}/leave";
const missingRoute = "/applications/{param}/activities/{param}/instances/{param}/leave";
const assignedRouteName = "POST_APPLICATIONS_APPLICATION_ID_ACTIVITIES_INSTANCE_LOCATION_ID_INSTANCES_INSTANCE_INSTANCE_ID_LEAVE";

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /applications/:application_id/activities/:instance_location_id/instances/:instance_instance_id/leave", () => {
    test("declares authenticated leave route metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Leave Embedded Activity Instance",
            description:
                "Leaves a locally persisted embedded activity instance for the authenticated user's own session and voice location. The route fails closed when the session, voice state, or matching activity instance cannot be verified locally.",
            requestBody: "EmbeddedActivityInstanceLeaveSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "EmbeddedActivityInstanceLeaveResponse",
                },
                400: {
                    body: "APIErrorResponse",
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

    test("parses embedded activity location and instance IDs", () => {
        const { activityMatchesEmbeddedActivityInstance, getEmbeddedActivityInstanceId, parseEmbeddedActivityLocationId, toEmbeddedActivityInstanceId } = loadRouteModule();

        const privateLocation = parseEmbeddedActivityLocationId("pc-222222222222222222");
        const guildLocation = parseEmbeddedActivityLocationId("gc-111111111111111111-222222222222222222");

        assert.deepEqual(privateLocation, {
            id: "pc-222222222222222222",
            kind: "pc",
            channelId: "222222222222222222",
        });
        assert.deepEqual(guildLocation, {
            id: "gc-111111111111111111-222222222222222222",
            kind: "gc",
            guildId: "111111111111111111",
            channelId: "222222222222222222",
        });
        assert.equal(parseEmbeddedActivityLocationId("pc-"), undefined);
        assert.equal(parseEmbeddedActivityLocationId("gc-111"), undefined);

        assert.ok(privateLocation);
        assert.equal(toEmbeddedActivityInstanceId("333333333333333333", privateLocation), "i-333333333333333333-pc-222222222222222222");
        assert.equal(getEmbeddedActivityInstanceId("i-333333333333333333-pc-222222222222222222", privateLocation), "333333333333333333");
        assert.equal(activityMatchesEmbeddedActivityInstance(createActivity({ party: { id: "333333333333333333" } }), "application", privateLocation, "333333333333333333"), true);
        assert.equal(
            activityMatchesEmbeddedActivityInstance(
                createActivity({ party: { id: "i-333333333333333333-pc-222222222222222222" } }),
                "application",
                privateLocation,
                "333333333333333333",
            ),
            true,
        );
        assert.equal(
            activityMatchesEmbeddedActivityInstance(
                createActivity({ application_id: "other", party: { id: "333333333333333333" } }),
                "application",
                privateLocation,
                "333333333333333333",
            ),
            false,
        );
    });

    test("removes the matching activity from the caller session and emits a presence update", async () => {
        const { leaveEmbeddedActivityInstance } = loadRouteModule();
        const removedActivity = createActivity({
            name: "Activity to leave",
            party: { id: "333333333333333333" },
        });
        const otherInstance = createActivity({
            name: "Other instance",
            party: { id: "444444444444444444" },
        });
        const otherApplication = createActivity({
            application_id: "other-application",
            name: "Other application",
            party: { id: "333333333333333333" },
        });
        const harness = createDependencies({
            session: createSession({
                activities: [removedActivity, otherInstance, otherApplication],
                client_status: { web: "online" },
            }),
            voiceState: {
                user_id: "user",
                session_id: "session",
                channel_id: "222222222222222222",
                guild_id: null,
            },
        });

        assert.deepEqual(
            await leaveEmbeddedActivityInstance(
                {
                    applicationId: "application",
                    locationId: "pc-222222222222222222",
                    instanceId: "333333333333333333",
                    sessionId: "session",
                    userId: "user",
                },
                harness.dependencies,
            ),
            {},
        );

        assert.deepEqual(harness.calls.findSession, [{ userId: "user", sessionId: "session" }]);
        assert.deepEqual(harness.calls.findVoiceState, [{ userId: "user", sessionId: "session", channelId: "222222222222222222" }]);
        assert.deepEqual(harness.calls.updateSessionActivities, [
            {
                userId: "user",
                sessionId: "session",
                activities: [otherInstance, otherApplication],
            },
        ]);
        assert.deepEqual(harness.calls.emitPresenceUpdate, [
            {
                event: "PRESENCE_UPDATE",
                user_id: "user",
                data: {
                    user: { id: "user" },
                    status: "online",
                    activities: [otherInstance, otherApplication],
                    client_status: { web: "online" },
                },
            },
        ]);
    });

    test("fails closed for missing session, mismatched location, and absent activity instance", async () => {
        const { EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS, EMBEDDED_ACTIVITY_LEAVE_UNKNOWN_SESSION, leaveEmbeddedActivityInstance } = loadRouteModule();

        const baseRequest = {
            applicationId: "application",
            locationId: "pc-222222222222222222",
            instanceId: "333333333333333333",
            sessionId: "session",
            userId: "user",
        };

        const missingSession = createDependencies({ session: null });
        await assert.rejects(
            () => leaveEmbeddedActivityInstance(baseRequest, missingSession.dependencies),
            (error) => error === EMBEDDED_ACTIVITY_LEAVE_UNKNOWN_SESSION,
        );
        assert.deepEqual(missingSession.calls.updateSessionActivities, []);

        const wrongLocation = createDependencies({
            voiceState: {
                user_id: "user",
                session_id: "session",
                channel_id: "other-channel",
                guild_id: null,
            },
        });
        await assert.rejects(
            () => leaveEmbeddedActivityInstance(baseRequest, wrongLocation.dependencies),
            (error) => error === EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS,
        );
        assert.deepEqual(wrongLocation.calls.updateSessionActivities, []);

        const missingActivity = createDependencies({
            session: createSession({
                activities: [createActivity({ party: { id: "444444444444444444" } })],
            }),
        });
        await assert.rejects(
            () => leaveEmbeddedActivityInstance(baseRequest, missingActivity.dependencies),
            (error) => error === EMBEDDED_ACTIVITY_LEAVE_MISSING_ACCESS,
        );
        assert.deepEqual(missingActivity.calls.updateSessionActivities, []);
    });

    test("serves the route through Express using the authenticated user and JSON body session", async (t) => {
        const harness = createDependencies({
            session: createSession({
                activities: [createActivity({ party: { id: "333333333333333333" } })],
            }),
        });
        const app = setupActivityLeaveRoute(t, harness.dependencies);

        const response = await requestJson(app, "/applications/application/activities/pc-222222222222222222/instances/333333333333333333/leave", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session_id: "session" }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {});
        assert.deepEqual(harness.calls.updateSessionActivities, [
            {
                userId: "user",
                sessionId: "session",
                activities: [],
            },
        ]);
    });

    test("generated artifacts own only the exact source-backed POST embedded activity leave path", () => {
        const routeSource = readFileSync(path.join(process.cwd(), sourceFile), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<TestingManifest>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContracts>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.match(routeSource, /requestBody:\s*"EmbeddedActivityInstanceLeaveSchema"/);
        assert.match(routeSource, /body:\s*"EmbeddedActivityInstanceLeaveResponse"/);

        assert.deepEqual(schemas.EmbeddedActivityInstanceLeaveSchema?.required, ["session_id"]);
        assert.equal(schemas.EmbeddedActivityInstanceLeaveSchema?.properties?.session_id?.type, "string");
        assert.equal(schemas.EmbeddedActivityInstanceLeaveResponse?.additionalProperties, false);

        const openapiRoute = openapi.paths?.["/applications/{application_id}/activities/{instance_location_id}/instances/{instance_instance_id}/leave/"]?.post;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/EmbeddedActivityInstanceLeaveSchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/EmbeddedActivityInstanceLeaveResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRouteEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === sourceRoute);
        assert.equal(sourceRouteEntry?.route_name, assignedRouteName);
        assert.equal(sourceRouteEntry?.source, sourceFile);
        assert.equal(sourceRouteEntry?.request_schema_ref, "EmbeddedActivityInstanceLeaveSchema");
        assert.deepEqual(sourceRouteEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "EmbeddedActivityInstanceLeaveResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === missingRoute && entry.route_name === assignedRouteName),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "EmbeddedActivityInstanceLeaveSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "EmbeddedActivityInstanceLeaveResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 403, 404],
        );

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, sourceFile);
        assert.equal(contractEntry?.routeMetadata?.requestBody, "EmbeddedActivityInstanceLeaveSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "EmbeddedActivityInstanceLeaveResponse"]);
    });
});

function loadRouteModule(): typeof import("./leave") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./leave");
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

function setupActivityLeaveRoute(t: TestContext, dependencies: EmbeddedActivityLeaveDependencies) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as {
        route: (routeOption: unknown) => express.RequestHandler;
    };
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../../../../middlewares/ErrorHandler");

    t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());

    const router = loadRouteModule().createEmbeddedActivityInstanceLeaveRouter(dependencies);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user";
        next();
    });
    app.use("/applications/:application_id/activities/:instance_location_id/instances/:instance_instance_id/leave", router);
    app.use(errorHandlerModule.ErrorHandler);

    return app;
}

type DependencyCalls = {
    emitPresenceUpdate: unknown[];
    findSession: { userId: string; sessionId: string }[];
    findVoiceState: { userId: string; sessionId: string; channelId: string }[];
    updateSessionActivities: { userId: string; sessionId: string; activities: Activity[] }[];
};

type DependencyOptions = {
    session?: EmbeddedActivityLeaveSession | null;
    voiceState?: EmbeddedActivityLeaveVoiceState | null;
};

function createDependencies(options: DependencyOptions = {}) {
    const calls: DependencyCalls = {
        emitPresenceUpdate: [],
        findSession: [],
        findVoiceState: [],
        updateSessionActivities: [],
    };

    const dependencies: EmbeddedActivityLeaveDependencies = {
        findSession: async (userId, sessionId) => {
            calls.findSession.push({ userId, sessionId });
            return options.session === undefined ? createSession() : options.session;
        },
        findVoiceState: async (userId, sessionId, channelId) => {
            calls.findVoiceState.push({ userId, sessionId, channelId });
            return options.voiceState === undefined
                ? {
                      user_id: userId,
                      session_id: sessionId,
                      channel_id: "222222222222222222",
                      guild_id: null,
                  }
                : options.voiceState;
        },
        updateSessionActivities: async (userId, sessionId, activities) => {
            calls.updateSessionActivities.push({ userId, sessionId, activities });
        },
        getPublicUser: async (userId) => ({ id: userId }) as PublicUser,
        emitPresenceUpdate: async (event) => {
            calls.emitPresenceUpdate.push(event);
        },
    };

    return { calls, dependencies };
}

function createActivity(overrides: Partial<Activity> = {}): Activity {
    return {
        application_id: "application",
        name: "Embedded Activity",
        party: {
            id: "333333333333333333",
        },
        type: 0,
        ...overrides,
    };
}

function createSession(overrides: Partial<EmbeddedActivityLeaveSession> = {}): EmbeddedActivityLeaveSession {
    return {
        user_id: "user",
        session_id: "session",
        status: "online",
        activities: [createActivity()],
        client_status: {},
        ...overrides,
    };
}

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
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

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        Record<
            string,
            {
                requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            }
        >
    >;
};

type SourceCatalogEntry = {
    method?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries?: { method?: string; route?: string; route_name?: string }[];
};

type TestingManifest = {
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

type HttpContracts = {
    contracts?: {
        manifestId?: string;
        routeMetadata?: {
            requestBody?: string;
            responses?: string[];
        };
        sourceFile?: string;
    }[];
};

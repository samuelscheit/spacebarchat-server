/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import { ActivityType, Relationship, Session, type Activity } from "@spacebar/util";
import activityMetadataRouter, {
    ACTIVITY_METADATA_MISSING_ACCESS,
    ACTIVITY_METADATA_UNKNOWN_SESSION,
    findActivityForMetadata,
    getActivityMetadataFromSession,
    getActivityMetadataResponse,
    type ActivityMetadataSession,
} from "../../src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/metadata";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:GET:/users/:user_id/sessions/:session_id/activities/:application_id/metadata/";
const sourceRoute = "/users/{user_id}/sessions/{session_id}/activities/{application_id}/metadata";
const assignedMissingRoute = "/users/{param}/sessions/{param}/activities/{param}/metadata";

describe("GET /users/:user_id/sessions/:session_id/activities/:application_id/metadata", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/users/:user_id/sessions/:session_id/activities/:application_id/metadata/");
    });

    test("returns locally stored metadata for the requester's own application activity", async (t) => {
        const session = activitySession({
            user_id: "owner",
            session_id: "session-a",
            activities: [
                {
                    name: "Other Game",
                    type: ActivityType.GAME,
                    application_id: "222222222222222222",
                    metadata: { button_urls: ["https://ignored.example"] },
                } as unknown as Activity,
                {
                    name: "Rocket League",
                    type: ActivityType.GAME,
                    application_id: "379286085710381999",
                    metadata: { button_urls: ["https://join.example"] },
                } as unknown as Activity,
            ],
        });
        const harness = setupActivityMetadataRoute(t, { userId: "owner", session });

        const response = await requestRoute(harness.app, "/users/owner/sessions/session-a/activities/379286085710381999/metadata");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { button_urls: ["https://join.example"] });
        assert.equal(harness.relationshipCountOptions.length, 0);
        assert.equal(harness.sessionFindOptions.length, 1);
        assert.deepEqual(harness.sessionFindOptions[0], {
            where: {
                user_id: "owner",
                session_id: "session-a",
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

    test("uses application_id 0 to return the last unassociated listening activity metadata", () => {
        const activities = [
            { name: "Spotify", type: ActivityType.LISTENING, metadata: { album_id: "first", artist_ids: ["artist-a"], context_uri: "spotify:album:first" } },
            { name: "Other Listening", type: ActivityType.LISTENING, application_id: "111111111111111111", metadata: { album_id: "associated", artist_ids: ["artist-b"] } },
            { name: "Spotify", type: ActivityType.LISTENING, metadata: { album_id: "last", artist_ids: ["artist-c"], type: "track" } },
        ] as Activity[];

        assert.deepEqual(findActivityForMetadata(activities, "0")?.metadata, { album_id: "last", artist_ids: ["artist-c"], type: "track" });
        assert.deepEqual(getActivityMetadataFromSession(activitySession({ activities }), "0"), { album_id: "last", artist_ids: ["artist-c"], type: "track" });
    });

    test("returns 204 when a matching local activity has no metadata", async (t) => {
        const harness = setupActivityMetadataRoute(t, {
            userId: "owner",
            session: activitySession({
                user_id: "owner",
                session_id: "session-a",
                activities: [{ name: "Rocket League", type: ActivityType.GAME, application_id: "379286085710381999" }],
            }),
        });

        const response = await requestRoute(harness.app, "/users/owner/sessions/session-a/activities/379286085710381999/metadata");

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
    });

    test("requires a friend relationship before exposing another user's activity metadata", async (t) => {
        const harness = setupActivityMetadataRoute(t, {
            userId: "viewer",
            session: activitySession({ user_id: "target", session_id: "target-session" }),
            relationshipCount: 0,
        });

        const response = await requestRoute(harness.app, "/users/target/sessions/target-session/activities/379286085710381999/metadata");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: ACTIVITY_METADATA_MISSING_ACCESS.code,
            message: ACTIVITY_METADATA_MISSING_ACCESS.message,
        });
        assert.equal(harness.sessionFindOptions.length, 0);
    });

    test("does not expose invisible friend sessions", async (t) => {
        const harness = setupActivityMetadataRoute(t, {
            userId: "viewer",
            relationshipCount: 1,
            session: activitySession({
                user_id: "target",
                session_id: "hidden-session",
                status: "invisible",
                activities: [
                    {
                        name: "Hidden Game",
                        type: ActivityType.GAME,
                        application_id: "379286085710381999",
                        metadata: { button_urls: ["https://hidden.example"] },
                    } as unknown as Activity,
                ],
            }),
        });

        const response = await requestRoute(harness.app, "/users/target/sessions/hidden-session/activities/379286085710381999/metadata");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: ACTIVITY_METADATA_MISSING_ACCESS.code,
            message: ACTIVITY_METADATA_MISSING_ACCESS.message,
        });
        assert.equal(harness.relationshipCountOptions.length, 1);
        assert.equal(harness.sessionFindOptions.length, 1);
    });

    test("returns unknown session for accessible user/session tuples not present locally", async (t) => {
        const harness = setupActivityMetadataRoute(t, {
            userId: "viewer",
            relationshipCount: 1,
            session: null,
        });

        const response = await requestRoute(harness.app, "/users/target/sessions/missing-session/activities/379286085710381999/metadata");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: ACTIVITY_METADATA_UNKNOWN_SESSION.code,
            message: ACTIVITY_METADATA_UNKNOWN_SESSION.message,
        });
    });

    test("keeps the route behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/users/:user_id/sessions/:session_id/activities/:application_id/metadata", activityMetadataRouter);
        app.use(ErrorHandler);

        const response = await requestRoute(app, "/users/target/sessions/session/activities/0/metadata");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/target/sessions/session/activities/0/metadata"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/users/target/sessions/session/activities/0/metadata"), false);
    });

    test("supports direct helper dependency injection", async () => {
        const response = await getActivityMetadataResponse("viewer", "target", "session", "0", {
            countFriendRelationship: async () => 1,
            findSession: async () =>
                activitySession({
                    user_id: "target",
                    session_id: "session",
                    activities: [{ name: "Spotify", type: ActivityType.LISTENING, metadata: { album_id: "album", artist_ids: ["artist"] } }],
                }),
        });

        assert.deepEqual(response, { album_id: "album", artist_ids: ["artist"] });
    });

    test("declares schema, generated route artifacts, and missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>("assets", "schemas.json");
        const openapi = readJson<OpenApiDocument>("assets", "openapi.json");
        const manifest = readJson<TestingManifest>("assets", "testing-manifest.json");
        const sourceCatalog = readJson<SourceCatalogEntry[]>("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const missingRoutes = readJson<MissingRoutesReport>("packages", "missing-routes", "missing.json");
        const contracts = readJson<ContractCatalog>("test", "generated", "http-contracts.json");
        const suiteCoverage = readJson<unknown>("test", "generated", "suite-coverage.json");

        assert.equal(schemas.ActivityMetadataResponse?.properties?.button_urls?.items?.type, "string");
        assert.equal(schemas.ActivityMetadataResponse?.properties?.artist_ids?.items?.type, "string");
        assert.equal(schemas.ActivityMetadataResponse?.properties?.album_id?.type, "string");
        assert.equal(schemas.ActivityMetadataResponse?.properties?.context_uri?.type, "string");
        assert.equal(schemas.ActivityMetadataResponse?.additionalProperties !== false, true);

        const route = openapi.paths?.["/users/{user_id}/sessions/{session_id}/activities/{application_id}/metadata/"]?.get;
        assert.equal(route?.summary, "Get Activity Metadata");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivityMetadataResponse");
        assert.equal(route?.responses?.["204"]?.description, "No description available");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ActivityMetadataResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 204, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === sourceRoute);
        assert.equal(catalogEntry?.source, "src/api/routes/users/#user_id/sessions/#session_id/activities/#application_id/metadata.ts");
        assert.equal(catalogEntry?.route_name, "GET_USERS_USER_ID_SESSIONS_SESSION_ID_ACTIVITIES_APPLICATION_ID_METADATA");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ActivityMetadataResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === assignedMissingRoute),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/users/{param}/sessions/{param}/activities/{param}/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/users/{param}/sessions/{param}/activities/{param}/1"),
            true,
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata.responses.sort(), ["APIErrorResponse", "ActivityMetadataResponse"]);

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
    });
});

type TestSessionStatus = ActivityMetadataSession["status"];

type SetupOptions = {
    userId?: string;
    relationshipCount?: number;
    session?: ActivityMetadataSession | null;
};

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }>; description?: string }>;
                security?: Array<Record<string, unknown>>;
            };
        }
    >;
};

type TestingManifest = {
    entries?: Array<{
        id: string;
        authMode?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }>;
};

type SourceCatalogEntry = {
    method: string;
    route: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type MissingRoutesReport = {
    missing_entries: Array<{
        method: string;
        route: string;
    }>;
};

type ContractCatalog = {
    contracts?: Array<{
        manifestId: string;
        authMode?: string;
        routeMetadata: {
            responses: string[];
        };
    }>;
};

function activitySession(overrides: Partial<ActivityMetadataSession> = {}): ActivityMetadataSession {
    return {
        user_id: overrides.user_id ?? "owner",
        session_id: overrides.session_id ?? "session-a",
        status: overrides.status ?? ("online" as TestSessionStatus),
        activities: overrides.activities ?? [
            { name: "Rocket League", type: ActivityType.GAME, application_id: "379286085710381999", metadata: { button_urls: ["https://join.example"] } } as unknown as Activity,
        ],
    };
}

function setupActivityMetadataRoute(t: TestContext, options: SetupOptions) {
    const relationshipCountOptions: unknown[] = [];
    const sessionFindOptions: unknown[] = [];

    t.mock.method(Relationship, "count", async (countOptions: unknown) => {
        relationshipCountOptions.push(countOptions);
        return options.relationshipCount ?? 0;
    });
    t.mock.method(Session, "findOne", async (findOptions: unknown) => {
        sessionFindOptions.push(findOptions);
        return (options.session === undefined ? activitySession() : options.session) as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "owner";
        next();
    });
    app.use("/users/:user_id/sessions/:session_id/activities/:application_id/metadata", activityMetadataRouter);
    app.use(ErrorHandler);

    return {
        app,
        get relationshipCountOptions() {
            return relationshipCountOptions;
        },
        get sessionFindOptions() {
            return sessionFindOptions;
        },
    };
}

function readJson<T>(...segments: string[]): T {
    return JSON.parse(readFileSync(join(process.cwd(), ...segments), "utf8")) as T;
}

async function requestRoute(app: express.Express, requestPath: string): Promise<{ status: number; text: string; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);
        const text = await response.text();

        return {
            status: response.status,
            text,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        server.close();
    }
}

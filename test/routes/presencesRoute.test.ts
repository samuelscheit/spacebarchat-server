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
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import { Relationship, Session, type Activity } from "@spacebar/util";
import presencesRouter, { buildPresencesResponse, serializePresence } from "../../src/api/routes/presences";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/presences/"];

describe("GET /presences", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/presences/"]);
    });

    test("serializes only locally backed non-offline friend presences with activities", async (t) => {
        const harness = setupPresencesRoute(t, {
            relationships: [
                relationship("active-friend", "active"),
                relationship("invisible-friend", "hidden"),
                relationship("quiet-friend", "quiet"),
                relationship("unknown-friend", "unknown"),
                { to_id: "missing-user" },
            ],
            sessions: [
                {
                    user_id: "active-friend",
                    status: "online",
                    activities: [{ name: "Rocket League", type: 0, application_id: "379286085710381999" }],
                    client_status: { desktop: "online" },
                },
                {
                    user_id: "invisible-friend",
                    status: "invisible",
                    activities: [{ name: "Hidden Game", type: 0 }],
                    client_status: { desktop: "online" },
                },
                {
                    user_id: "quiet-friend",
                    status: "idle",
                    activities: [],
                    client_status: { web: "idle" },
                },
                {
                    user_id: "unknown-friend",
                    status: "unknown",
                    activities: [{ name: "Recently Opened", type: 0 }],
                    client_status: {},
                },
                {
                    user_id: "missing-user",
                    status: "online",
                    activities: [{ name: "No User Projection", type: 0 }],
                    client_status: { web: "online" },
                },
            ],
        });

        const response = await requestJson(harness.app, "/presences");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            guilds: [],
            presences: [
                {
                    user: {
                        id: "active-friend",
                        username: "active",
                        discriminator: "0001",
                        avatar: null,
                        public_flags: 0,
                    },
                    status: "online",
                    activities: [{ name: "Rocket League", type: 0, application_id: "379286085710381999" }],
                    client_status: { desktop: "online" },
                },
                {
                    user: {
                        id: "unknown-friend",
                        username: "unknown",
                        discriminator: "0001",
                        avatar: null,
                        public_flags: 0,
                    },
                    status: "online",
                    activities: [{ name: "Recently Opened", type: 0 }],
                    client_status: {},
                },
            ],
            applications: [],
        });

        assert.equal(harness.relationshipFindOptions.length, 1);
        assert.equal(harness.sessionFindOptions.length, 1);
        const sessionFindOptions = harness.sessionFindOptions[0] as {
            select?: Record<string, boolean>;
            where?: {
                is_admin_session?: boolean;
                user_id?: { _value?: string[] };
            };
        };
        assert.equal(sessionFindOptions.where?.is_admin_session, false);
        assert.deepEqual(sessionFindOptions.where?.user_id?._value, ["active-friend", "invisible-friend", "quiet-friend", "unknown-friend", "missing-user"]);
        assert.deepEqual(sessionFindOptions.select, {
            user_id: true,
            status: true,
            activities: true,
            client_status: true,
        });
    });

    test("returns an empty documented response when the viewer has no local friend relationships", async (t) => {
        const harness = setupPresencesRoute(t, { relationships: [] });

        assert.deepEqual(await buildPresencesResponse("viewer"), {
            guilds: [],
            presences: [],
            applications: [],
        });
        assert.equal(harness.relationshipFindOptions.length, 1);
        assert.equal(harness.sessionFindOptions.length, 0);
    });

    test("keeps the route behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/presences", presencesRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/presences");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/presences"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/presences"), false);
    });

    test("does not serialize a presence without a local public user projection", () => {
        assert.equal(
            serializePresence({ to_id: "missing-user" }, {
                user_id: "missing-user",
                status: "online",
                activities: [{ name: "Game", type: 0 }],
                client_status: {},
            } as TestSession),
            undefined,
        );
    });

    test("declares schemas and generated route artifacts", () => {
        const schemas = readJson<Record<string, JsonSchema>>("assets", "schemas.json");
        const openapi = readJson<OpenApiDocument>("assets", "openapi.json");
        const manifest = readJson<TestingManifest>("assets", "testing-manifest.json");
        const sourceCatalog = readJson<SourceCatalogEntry[]>("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const missingRoutes = readJson<MissingRoutesReport>("packages", "missing-routes", "missing.json");
        const contracts = readJson<ContractCatalog>("test", "generated", "http-contracts.json");

        assert.equal(schemas.PresencesResponse?.properties?.guilds?.items?.$ref, "#/definitions/PresenceResponseVoiceGuild");
        assert.equal(schemas.PresencesResponse?.properties?.presences?.items?.$ref, "#/definitions/PresenceResponsePresence");
        assert.equal(schemas.PresencesResponse?.properties?.applications?.items?.$ref, "#/definitions/PresenceResponseApplication");
        assert.deepEqual(schemas.PresencesResponse?.required?.sort(), ["applications", "guilds", "presences"]);
        assert.equal(schemas.PresenceResponsePresence?.properties?.hidden_activities?.items?.$ref, "#/definitions/PresenceResponseActivity");
        assert.equal(schemas.PresenceResponsePresence?.properties?.has_played_game?.type, "boolean");

        const openapiRoute = openapi.paths?.["/presences/"]?.get;
        assert.equal(openapiRoute?.summary, "Get Presences");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PresencesResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PresencesResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/presences");
        assert.equal(sourceCatalogEntry?.route_name, "GET_PRESENCES");
        assert.equal(sourceCatalogEntry?.source, "src/api/routes/presences.ts");
        assert.deepEqual(sourceCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "PresencesResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/presences"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/presences"),
            true,
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata.responses.sort(), ["APIErrorResponse", "PresencesResponse"]);
    });
});

type TestRelationship = {
    to_id: string;
    to?: {
        toPublicUser(): {
            id: string;
            username: string;
            discriminator: string;
            avatar: null;
            public_flags: number;
        };
    };
};

type TestSession = {
    user_id: string;
    status: "idle" | "dnd" | "online" | "offline" | "invisible" | "unknown";
    activities: Activity[];
    client_status: Record<string, string>;
};

type SetupOptions = {
    relationships?: TestRelationship[];
    sessions?: TestSession[];
    userId?: string;
};

type JsonSchema = {
    $ref?: string;
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
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
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

function relationship(id: string, username: string): TestRelationship {
    return {
        to_id: id,
        to: {
            toPublicUser: () => ({
                id,
                username,
                discriminator: "0001",
                avatar: null,
                public_flags: 0,
            }),
        },
    };
}

function setupPresencesRoute(t: TestContext, options: SetupOptions) {
    const relationshipFindOptions: unknown[] = [];
    const sessionFindOptions: unknown[] = [];

    t.mock.method(Relationship, "find", async (findOptions: unknown) => {
        relationshipFindOptions.push(findOptions);
        return (options.relationships ?? []) as never;
    });
    t.mock.method(Session, "find", async (findOptions: unknown) => {
        sessionFindOptions.push(findOptions);
        return (options.sessions ?? []) as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/presences", presencesRouter);
    app.use(ErrorHandler);

    return {
        app,
        get relationshipFindOptions() {
            return relationshipFindOptions;
        },
        get sessionFindOptions() {
            return sessionFindOptions;
        },
    };
}

function readJson<T>(...segments: string[]): T {
    return JSON.parse(readFileSync(join(process.cwd(), ...segments), "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        server.close();
    }
}

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
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import {
    APPLICATIONS_GAMES_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE,
    createApplicationsGamesSupplementalMutationUnsupportedError,
    createApplicationsGamesSupplementalRouter,
    listApplicationsGamesSupplementalData,
    parseApplicationsGamesSupplementalQuery,
    type ApplicationsGamesSupplementalRepositories,
} from "../../src/api/routes/applications/games-supplemental";
import type { GameSupplementalApplication } from "../../src/api/util/utility/GameResponse";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/applications/games-supplemental/", "api:http:PATCH:/applications/games-supplemental/"];
const assignedPath = "/applications/games-supplemental";
const assignedPatchRouteName = "APPLICATIONS_GAMES_SUPPLEMENTAL";
const sourceGetRouteName = "GET_APPLICATIONS_GAMES_SUPPLEMENTAL";
const sourcePatchRouteName = "PATCH_APPLICATIONS_GAMES_SUPPLEMENTAL";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET and PATCH /applications/games-supplemental", () => {
    test("documents the assigned manifest id and remains bearer-authenticated", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/applications/games-supplemental/", "api:http:PATCH:/applications/games-supplemental/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/applications/games-supplemental?application_ids=100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/applications/games-supplemental/"), false);
        assert.equal(isNoAuthorizationRoute("PATCH", "/api/v10/applications/games-supplemental"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/applications/non-games/detectable"), true);

        const getResponse = await requestJson(createRouteApp({ authentication: true }), "/applications/games-supplemental?application_ids=100000000000000001");
        const patchResponse = await requestJson(createRouteApp({ authentication: true }), "/applications/games-supplemental", { method: "PATCH" });

        assert.equal(getResponse.status, 401);
        assert.equal((getResponse.body as { code?: unknown }).code, 401);
        assert.equal(patchResponse.status, 401);
        assert.equal((patchResponse.body as { code?: unknown }).code, 401);
    });

    test("parses application IDs with game ID compatibility aliases", () => {
        assert.deepEqual(
            parseApplicationsGamesSupplementalQuery({
                application_ids: ["100000000000000001,100000000000000002", "100000000000000001"],
                "application_ids[]": ["100000000000000003"],
                game_ids: ["100000000000000004"],
                "game_ids[]": "100000000000000005",
            } as never),
            ["100000000000000001", "100000000000000002", "100000000000000003", "100000000000000004", "100000000000000005"],
        );
    });

    test("rejects missing, malformed, or oversized application ID queries", async () => {
        assert.throws(() => parseApplicationsGamesSupplementalQuery({} as never), { code: 50035 });
        assert.throws(() => parseApplicationsGamesSupplementalQuery({ application_ids: "not-a-snowflake" } as never), { code: 50035 });
        assert.throws(
            () =>
                parseApplicationsGamesSupplementalQuery({
                    application_ids: Array.from({ length: 101 }, (_, index) => String(100000000000000000n + BigInt(index))),
                } as never),
            { code: 50035 },
        );

        const response = await requestJson(createRouteApp(), "/applications/games-supplemental");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                application_ids: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "application_ids is required",
                        },
                    ],
                },
            },
        });
    });

    test("returns requested local supplemental game data without fabricating catalog fields", async () => {
        const harness = createRepositoryHarness();
        const requestedIds = ["100000000000000002", "100000000000000001", "100000000000000099"];

        assert.deepEqual(await listApplicationsGamesSupplementalData(requestedIds, harness.repositories), [
            {
                application_id: "100000000000000002",
                name: "Second Game",
                icon_hash: null,
            },
            {
                application_id: "100000000000000001",
                name: "First Game",
                summary: "The first game.",
                icon_hash: "icon-one",
                announcements_channel_id: "100000000000000011",
            },
        ]);

        const response = await requestJson(
            createRouteApp({ repositories: harness.repositories }),
            "/applications/games-supplemental?application_ids=100000000000000002&application_ids=100000000000000001&application_ids=100000000000000099",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                application_id: "100000000000000002",
                name: "Second Game",
                icon_hash: null,
            },
            {
                application_id: "100000000000000001",
                name: "First Game",
                summary: "The first game.",
                icon_hash: "icon-one",
                announcements_channel_id: "100000000000000011",
            },
        ]);
        assert.equal(harness.findOptions.length, 2);
        assert.deepEqual(Object.keys(harness.findOptions[0]?.select ?? {}).sort(), ["announcements_channel_id", "icon", "id", "name", "summary"]);
        assert.equal(
            (response.body as Record<string, unknown>[]).some((entry) => "trailers" in entry || "steam_id" in entry || "first_release_date" in entry),
            false,
        );
    });

    test("fails closed for unsupported PATCH mutations without touching application data", async () => {
        const harness = createRepositoryHarness();
        const error = createApplicationsGamesSupplementalMutationUnsupportedError();

        assert.equal(error.message, APPLICATIONS_GAMES_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE);
        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);

        const response = await requestJson(createRouteApp({ repositories: harness.repositories }), "/applications/games-supplemental", {
            method: "PATCH",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                application_id: "100000000000000001",
                summary: "A forged supplemental summary must not be persisted.",
            }),
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: APPLICATIONS_GAMES_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(harness.findOptions, []);
    });

    test("declares generated artifacts for the owned GET and PATCH methods", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "games-supplemental.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    patch?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    put?: unknown;
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                path?: string;
                sourceFile?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.equal(assignedPatchRouteName, "APPLICATIONS_GAMES_SUPPLEMENTAL");

        assert.match(routeSource, /summary:\s*"Get Application Game Supplemental Data"/);
        assert.match(routeSource, /application_ids:\s*\{\s*type:\s*"array",\s*required:\s*true/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationsGamesSupplementalResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /router\.patch\(/);
        assert.match(routeSource, /summary:\s*"Modify Application Game Supplemental Data"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.put\(/);

        assert.equal(schemas.ApplicationsGamesSupplementalResponse.type, "array");
        assert.equal(schemas.ApplicationsGamesSupplementalResponse.items?.$ref, "#/definitions/GameSupplementalData");

        const getRoute = openapi.paths?.["/applications/games-supplemental/"]?.get;
        assert.equal(
            getRoute?.parameters?.some((parameter) => parameter.name === "application_ids" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(getRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationsGamesSupplementalResponse");
        assert.equal(getRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(getRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(getRoute?.security, [{ bearer: [] }]);

        const patchRoute = openapi.paths?.["/applications/games-supplemental/"]?.patch;
        assert.equal(patchRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(patchRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(patchRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/applications/games-supplemental/"]?.put, undefined);

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(getManifestEntry?.path, `${assignedPath}/`);
        assert.equal(getManifestEntry?.sourceFile, "src/api/routes/applications/games-supplemental.ts");
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(getManifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationsGamesSupplementalResponse"), true);
        assert.equal(getManifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(getManifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(getManifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(getManifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const patchManifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[1]);
        assert.equal(patchManifestEntry?.path, `${assignedPath}/`);
        assert.equal(patchManifestEntry?.sourceFile, "src/api/routes/applications/games-supplemental.ts");
        assert.equal(patchManifestEntry?.authMode, "bearer");
        assert.equal(patchManifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(patchManifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(patchManifestEntry?.routeMetadata?.responseStatuses?.includes(501), true);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, sourceGetRouteName);
        assert.equal(sourceEntry?.source, "src/api/routes/applications/games-supplemental.ts");
        assert.equal(sourceEntry?.response_schema_refs?.includes("ApplicationsGamesSupplementalResponse"), true);
        assert.equal(sourceEntry?.response_schema_refs?.includes("APIErrorResponse"), true);

        const patchSourceEntry = sourceCatalog.find((entry) => entry.method === "PATCH" && entry.route === assignedPath);
        assert.equal(patchSourceEntry?.route_name, sourcePatchRouteName);
        assert.equal(patchSourceEntry?.source, "src/api/routes/applications/games-supplemental.ts");
        assert.deepEqual(patchSourceEntry?.response_schema_refs, ["APIErrorResponse"]);
        assert.equal(sourceCatalog.some((entry) => entry.method === "PUT" && entry.route === assignedPath), false);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === assignedPath),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === assignedPath),
            true,
        );

        const getContract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(getContract?.authMode, "bearer");
        assert.equal(getContract?.routeMetadata?.responses?.includes("ApplicationsGamesSupplementalResponse"), true);
        assert.equal(getContract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.equal(getContract?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(getContract?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(getContract?.routeMetadata?.responseStatuses?.includes(401), true);

        const patchContract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[1]);
        assert.equal(patchContract?.authMode, "bearer");
        assert.equal(patchContract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.equal(patchContract?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(patchContract?.routeMetadata?.responseStatuses?.includes(501), true);
    });
});

function createRepositoryHarness() {
    const findOptions: ({ where?: { id?: unknown }; select?: Record<string, boolean> } | undefined)[] = [];
    const applications = [
        createApplication("100000000000000001", "First Game", "icon-one", "The first game.", "100000000000000011"),
        createApplication("100000000000000002", "Second Game", null, "", null),
    ];
    const repositories: ApplicationsGamesSupplementalRepositories = {
        applicationRepository: {
            find: async (findOptionsInput) => {
                findOptions.push(findOptionsInput as (typeof findOptions)[number]);
                return applications as never;
            },
        },
    };

    return { findOptions, repositories };
}

function createApplication(id: string, name: string, icon: string | null, summary: string, announcementsChannelId: string | null): GameSupplementalApplication {
    return {
        id,
        name,
        icon: icon as never,
        summary,
        announcements_channel_id: announcementsChannelId,
    };
}

function createRouteApp(options: { authentication?: boolean; repositories?: ApplicationsGamesSupplementalRepositories } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    else {
        app.use((req, _res, next) => {
            req.user_id = "user";
            next();
        });
    }
    app.use("/applications/games-supplemental", createApplicationsGamesSupplementalRouter(options.repositories));
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string, init?: RequestInit) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, init);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

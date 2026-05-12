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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { ApplicationCommandAuthorizationRepository, ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";
import applicationStoreLayoutRouter, {
    APPLICATION_STORE_LAYOUT_UNSUPPORTED_MESSAGE,
    createApplicationStoreLayoutRouter,
    createApplicationStoreLayoutUnsupportedError,
    isApplicationStoreLayoutRouteSnowflake,
    updateApplicationStoreLayout,
    type ApplicationStoreLayoutDependencies,
} from "../../src/api/routes/applications/#application_id/store-layout";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const applicationId = "100000000000000001";
const coveredManifestId = "api:http:POST:/applications/:application_id/store-layout/";
const routePath = "/applications/:application_id/store-layout/";
const openApiPath = "/applications/{application_id}/store-layout/";
const sourceRoute = "/applications/{application_id}/store-layout";
const assignedRoute = "/applications/{param}/store-layout";
const assignedRouteName = "STORE_LAYOUT";
const siblingGetRouteName = "GET_APPLICATIONS_APPLICATION_ID_STORE_LAYOUT";

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

type JsonSchema = {
    $ref?: string;
};

describe("POST /applications/:application_id/store-layout", () => {
    test("stays behind bearer authentication and declares route metadata", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/applications/:application_id/store-layout/");
        assert.equal(isNoAuthorizationRoute("POST", `/api/v10/applications/${applicationId}/store-layout`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/applications/${applicationId}/store-layout`), false);

        const response = await requestJson(createAuthenticatedApp(), `/applications/${applicationId}/store-layout`);

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "store-layout.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Update Application Store Layout"/);
        assert.match(routeSource, /fails closed because Spacebar does not currently persist Discord application store layout state/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete)\(/);
    });

    test("checks application store access before failing closed without layout persistence", async () => {
        const unsupportedError = createApplicationStoreLayoutUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, APPLICATION_STORE_LAYOUT_UNSUPPORTED_MESSAGE);
        assert.equal(isApplicationStoreLayoutRouteSnowflake(applicationId), true);
        assert.equal(isApplicationStoreLayoutRouteSnowflake("not-a-snowflake"), false);

        await assert.rejects(() => updateApplicationStoreLayout("not-a-snowflake", "viewer"), {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
        });
        await assert.rejects(
            () =>
                updateApplicationStoreLayout(applicationId, "viewer", {
                    applicationRepository: applicationRepositoryFor(null),
                }),
            { code: DiscordApiErrors.UNKNOWN_APPLICATION.code },
        );
        await assert.rejects(
            () =>
                updateApplicationStoreLayout(applicationId, "viewer", {
                    applicationRepository: applicationRepositoryFor({
                        owner: { id: "owner" },
                        team: null,
                    }),
                }),
            { code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code },
        );

        for (const application of authorizedApplications()) {
            await assert.rejects(
                () =>
                    updateApplicationStoreLayout(applicationId, "viewer", {
                        applicationRepository: applicationRepositoryFor(application),
                    }),
                {
                    code: createApplicationStoreLayoutUnsupportedError().code,
                    message: APPLICATION_STORE_LAYOUT_UNSUPPORTED_MESSAGE,
                },
            );
        }
    });

    test("returns truthful mounted errors for malformed, unknown, unauthorized, and unsupported mutations", async () => {
        const malformed = await requestJson(createRouteApp(), "/applications/not-a-snowflake/store-layout");
        const unknownApplication = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor(null),
            }),
            `/applications/${applicationId}/store-layout`,
        );
        const unauthorized = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor({
                    owner: { id: "owner" },
                    team: null,
                }),
            }),
            `/applications/${applicationId}/store-layout`,
        );
        const unsupported = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor({
                    owner: { id: "viewer" },
                    team: null,
                }),
            }),
            `/applications/${applicationId}/store-layout`,
        );

        assert.equal(malformed.status, 404);
        assert.deepEqual(malformed.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(unknownApplication.status, 404);
        assert.deepEqual(unknownApplication.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(unauthorized.status, 403);
        assert.deepEqual(unauthorized.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(unsupported.status, 501);
        assert.deepEqual(unsupported.body, {
            code: 0,
            message: APPLICATION_STORE_LAYOUT_UNSUPPORTED_MESSAGE,
        });
    });

    test("is present in regenerated catalogs, manifest, contracts, OpenAPI, and removed from missing routes", () => {
        const openApi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                    };
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
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
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const operation = openApi.paths?.[openApiPath]?.post;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        for (const status of ["401", "403", "404", "501"]) {
            assert.equal(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.equal(operation?.responses?.["200"], undefined);
        assert.equal(openApi.paths?.[openApiPath]?.get, undefined);
        assert.equal(openApi.paths?.[openApiPath]?.put, undefined);
        assert.equal(openApi.paths?.[openApiPath]?.patch, undefined);
        assert.equal(openApi.paths?.[openApiPath]?.delete, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, routePath);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/applications/#application_id/store-layout.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [401, 403, 404, 501],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "POST" && entry.route === sourceRoute),
            {
                method: "POST",
                response_schema_refs: ["APIErrorResponse"],
                route: sourceRoute,
                route_name: "POST_APPLICATIONS_APPLICATION_ID_STORE_LAYOUT",
                source: "src/api/routes/applications/#application_id/store-layout.ts",
            },
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "PUT" && entry.route === sourceRoute),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "PATCH" && entry.route === sourceRoute),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "DELETE" && entry.route === sourceRoute),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedRoute && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedRoute && entry.route_name === siblingGetRouteName),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [401, 403, 404, 501],
        );
    });
});

function authorizedApplications(): ApplicationCommandAuthorizationTarget[] {
    return [
        {
            owner: { id: "viewer" },
            team: null,
        },
        {
            owner: { id: "owner" },
            bot: { id: "viewer" },
            team: null,
        },
        {
            owner: { id: "owner" },
            team: {
                owner_user_id: "team-owner",
                members: [
                    {
                        user_id: "viewer",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        },
    ];
}

function applicationRepositoryFor(application: ApplicationCommandAuthorizationTarget | null): ApplicationCommandAuthorizationRepository {
    return {
        findOne: async () => application,
    };
}

function createRouteApp(dependencies: ApplicationStoreLayoutDependencies = {}) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/applications/:application_id/store-layout", createApplicationStoreLayoutRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/applications/:application_id/store-layout", applicationStoreLayoutRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string): Promise<JsonResponse> {
    let server: Server | undefined;

    try {
        server = await new Promise<Server>((resolve) => {
            const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        });
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, {
            method: "POST",
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        if (server) {
            await new Promise<void>((resolve, reject) => {
                server?.close((error) => (error ? reject(error) : resolve()));
            });
        }
    }
}

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
import { isNoAuthorizationRoute } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";
import {
    createOAuth2ApplicationAssetRouter,
    deleteApplicationAsset,
    getApplicationAssetStoragePath,
    normalizeApplicationAssetRouteId,
    UNKNOWN_APPLICATION_ASSET,
    type ApplicationAssetDeleteDependencies,
} from "../../src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id";
import { createOAuth2ApplicationAssetsRouter, getApplicationAssets, type ApplicationAssetListDependencies } from "../../src/api/routes/oauth2/applications/#application_id/assets";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const getManifestId = "api:http:GET:/oauth2/applications/:application_id/assets/";
const getAssignedPath = "/oauth2/applications/{application_id}/assets";
const getAssignedRouteName = "GET_OAUTH2_APPLICATIONS_APPLICATION_ID_ASSETS";
const deleteManifestId = "api:http:DELETE:/oauth2/applications/:application_id/assets/:application_asset_id/";
const deleteAssignedPath = "/oauth2/applications/{application_id}/assets/{application_asset_id}";
const deleteAssignedRouteName = "DELETE_OAUTH2_APPLICATIONS_APPLICATION_ID_ASSETS_APPLICATION_ASSET_ID";
const applicationId = "100000000000000001";
const missingApplicationId = "100000000000000002";
const applicationAssetId = "100000000000000003";
const applicationAssetHashId = "a_0123456789abcdef0123456789abcdef";
const missingApplicationAssetId = "100000000000000004";

type JsonSchema = {
    $ref?: string;
    type?: string;
};

type ApplicationAssetRouteDependencies = ApplicationAssetDeleteDependencies & ApplicationAssetListDependencies;
type ApplicationAuthorizationTarget = Awaited<ReturnType<NonNullable<ApplicationAssetRouteDependencies["applicationRepository"]>["findOne"]>>;

function createApplicationRepository(t: TestContext, application: ApplicationAuthorizationTarget = { owner: { id: "owner" } }) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => application),
    };
}

function createRouteApp(userId: string, dependencies: ApplicationAssetRouteDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/oauth2/applications/:application_id/assets", createOAuth2ApplicationAssetsRouter(dependencies));
    app.use("/oauth2/applications/:application_id/assets/:application_asset_id", createOAuth2ApplicationAssetRouter(dependencies));
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestRaw(app: express.Express, path: string, method = "DELETE") {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { method });
        const text = await response.text();
        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("OAuth2 application asset routes", () => {
    test("declares authenticated developer-owned behavior for only the assigned OAuth2 asset routes", () => {
        assert.equal(isNoAuthorizationRoute("GET", `/oauth2/applications/${applicationId}/assets`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/oauth2/applications/${applicationId}/assets?nocache=true`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/oauth2/applications/${applicationId}/assets/${applicationAssetId}`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/api/v10/oauth2/applications/${applicationId}/assets/${applicationAssetId}`), false);
        assert.equal(isNoAuthorizationRoute("POST", `/oauth2/applications/${applicationId}/assets`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/store/applications/${applicationId}/assets/${applicationAssetId}`), false);
    });

    test("returns a conservative empty application asset list for accepted owning-team members", async (t) => {
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

        assert.deepEqual(await getApplicationAssets(applicationId, "read-only", { applicationRepository }), []);
        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });

        const response = await requestRaw(createRouteApp("read-only", { applicationRepository }), `/oauth2/applications/${applicationId}/assets?nocache=true`, "GET");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("returns 403 before listing assets for callers outside the owning application or team", async (t) => {
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

        const response = await requestRaw(createRouteApp("invited", { applicationRepository }), `/oauth2/applications/${applicationId}/assets`, "GET");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
    });

    test("returns 404 for unknown or malformed applications before listing assets", async (t) => {
        const missingApplicationRepository = createApplicationRepository(t, null);
        const unknownApplicationResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository: missingApplicationRepository }),
            `/oauth2/applications/${missingApplicationId}/assets`,
            "GET",
        );

        const malformedApplicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const malformedApplicationResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository: malformedApplicationRepository }),
            "/oauth2/applications/not-a-snowflake/assets",
            "GET",
        );

        assert.equal(unknownApplicationResponse.status, 404);
        assert.deepEqual(unknownApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(malformedApplicationResponse.status, 404);
        assert.deepEqual(malformedApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(malformedApplicationRepository.findOne.mock.callCount(), 0);
    });

    test("deletes an application asset from CDN storage and accepts extension-style CDN ids", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const deletedFiles: string[] = [];
        const deleteAssetFile = t.mock.fn(async (path: string) => deletedFiles.push(path));

        assert.equal(normalizeApplicationAssetRouteId(`${applicationAssetHashId}.png`), applicationAssetHashId);
        assert.equal(getApplicationAssetStoragePath(applicationId, `${applicationAssetHashId}.png`), `/app-assets/${applicationId}/${applicationAssetHashId}`);
        assert.equal(
            await deleteApplicationAsset(applicationId, `${applicationAssetHashId}.png`, "owner", {
                applicationRepository,
                deleteAssetFile,
            }),
            true,
        );

        assert.deepEqual(applicationRepository.findOne.mock.calls[0].arguments[0], {
            where: { id: applicationId },
            relations: {
                owner: true,
                team: {
                    members: true,
                },
            },
        });
        assert.deepEqual(deletedFiles, [`/app-assets/${applicationId}/${applicationAssetHashId}`]);
    });

    test("returns 204 for owners and accepted owning-team developers without a response body", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "team-developer",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.DEVELOPER,
                    },
                ],
            },
        });
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const response = await requestRaw(
            createRouteApp("team-developer", { applicationRepository, deleteAssetFile }),
            `/oauth2/applications/${applicationId}/assets/${applicationAssetId}`,
        );

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.equal(deleteAssetFile.mock.callCount(), 1);
    });

    test("returns 403 before deleting for callers outside the owning application or developer team", async (t) => {
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
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const response = await requestRaw(
            createRouteApp("read-only", { applicationRepository, deleteAssetFile }),
            `/oauth2/applications/${applicationId}/assets/${applicationAssetId}`,
        );

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(deleteAssetFile.mock.callCount(), 0);
    });

    test("returns source-compatible 404 errors for unknown applications and missing application assets", async (t) => {
        const missingApplicationRepository = createApplicationRepository(t, null);
        const skippedDeleteAssetFile = t.mock.fn(async (_path: string) => undefined);
        const unknownApplicationResponse = await requestRaw(
            createRouteApp("owner", {
                applicationRepository: missingApplicationRepository,
                deleteAssetFile: skippedDeleteAssetFile,
            }),
            `/oauth2/applications/${missingApplicationId}/assets/${applicationAssetId}`,
        );

        const applicationRepository = createApplicationRepository(t);
        const missingError = Object.assign(new Error("missing app asset"), { code: "ENOENT" });
        const deleteAssetFile = t.mock.fn(async (_path: string) => {
            throw missingError;
        });
        const unknownAssetResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, deleteAssetFile }),
            `/oauth2/applications/${applicationId}/assets/${missingApplicationAssetId}`,
        );

        assert.equal(unknownApplicationResponse.status, 404);
        assert.deepEqual(unknownApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(skippedDeleteAssetFile.mock.callCount(), 0);

        assert.equal(unknownAssetResponse.status, 404);
        assert.deepEqual(unknownAssetResponse.body, {
            code: UNKNOWN_APPLICATION_ASSET.code,
            message: UNKNOWN_APPLICATION_ASSET.message,
        });
        assert.equal(deleteAssetFile.mock.callCount(), 1);
    });

    test("validates malformed route IDs before mutating application asset storage", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const invalidApplicationResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, deleteAssetFile }),
            `/oauth2/applications/not-a-snowflake/assets/${applicationAssetId}`,
        );
        const invalidAssetResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, deleteAssetFile }),
            `/oauth2/applications/${applicationId}/assets/not$valid`,
        );

        assert.equal(invalidApplicationResponse.status, 404);
        assert.deepEqual(invalidApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(invalidAssetResponse.status, 404);
        assert.deepEqual(invalidAssetResponse.body, {
            code: UNKNOWN_APPLICATION_ASSET.code,
            message: UNKNOWN_APPLICATION_ASSET.message,
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 0);
        assert.equal(deleteAssetFile.mock.callCount(), 0);
    });

    test("declares generated artifacts for the exact assigned routes and removes the GET and DELETE missing entries", () => {
        const getRouteSource = readFileSync(join(process.cwd(), "src", "api", "routes", "oauth2", "applications", "#application_id", "assets", "index.ts"), "utf8");
        const deleteRouteSource = readFileSync(
            join(process.cwd(), "src", "api", "routes", "oauth2", "applications", "#application_id", "assets", "#application_asset_id.ts"),
            "utf8",
        );
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        security?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                    };
                    delete?: {
                        security?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                    };
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

        assert.match(getRouteSource, /summary:\s*"Get Application Assets"/);
        assert.match(getRouteSource, /nocache:\s*\{\s*type:\s*"boolean"/s);
        assert.match(getRouteSource, /200:\s*\{\s*body:\s*"ApplicationAssetsResponse"/s);
        assert.match(getRouteSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(getRouteSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(getRouteSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.match(deleteRouteSource, /summary:\s*"Delete Application Asset"/);
        assert.match(deleteRouteSource, /204:\s*\{\}/);
        assert.match(deleteRouteSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(deleteRouteSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(deleteRouteSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const getRoute = openapi.paths?.["/oauth2/applications/{application_id}/assets/"]?.get;
        assert.deepEqual(getRoute?.security, [{ bearer: [] }]);
        assert.equal(getRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationAssetsResponse");
        assert.equal(getRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(getRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(getRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const deleteRoute = openapi.paths?.["/oauth2/applications/{application_id}/assets/{application_asset_id}/"]?.delete;
        assert.deepEqual(deleteRoute?.security, [{ bearer: [] }]);
        assert.equal(deleteRoute?.responses?.["204"]?.content, undefined);
        assert.equal(deleteRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(deleteRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(deleteRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === getManifestId);
        assert.equal(getManifestEntry?.path, "/oauth2/applications/:application_id/assets/");
        assert.equal(getManifestEntry?.sourceFile, "src/api/routes/oauth2/applications/#application_id/assets/index.ts");
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ApplicationAssetsResponse"]);
        assert.deepEqual(
            getManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 403, 404],
        );

        const deleteManifestEntry = manifest.entries?.find((entry) => entry.id === deleteManifestId);
        assert.equal(deleteManifestEntry?.path, "/oauth2/applications/:application_id/assets/:application_asset_id/");
        assert.equal(deleteManifestEntry?.sourceFile, "src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts");
        assert.equal(deleteManifestEntry?.authMode, "bearer");
        assert.deepEqual(deleteManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            deleteManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [204, 401, 403, 404],
        );

        const getCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === getAssignedPath);
        assert.equal(getCatalogEntry?.route_name, getAssignedRouteName);
        assert.equal(getCatalogEntry?.source, "src/api/routes/oauth2/applications/#application_id/assets/index.ts");
        assert.deepEqual(getCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationAssetsResponse"]);

        const deleteCatalogEntry = sourceCatalog.find((entry) => entry.method === "DELETE" && entry.route === deleteAssignedPath);
        assert.equal(deleteCatalogEntry?.route_name, deleteAssignedRouteName);
        assert.equal(deleteCatalogEntry?.source, "src/api/routes/oauth2/applications/#application_id/assets/#application_asset_id.ts");
        assert.deepEqual(deleteCatalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/oauth2/applications/{param}/assets/{param}"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/oauth2/applications/{param}/assets"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/oauth2/applications/{param}/assets"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/store/applications/{param}/assets/{param}"),
            false,
        );

        const getContract = contractTests.contracts?.find((entry) => entry.manifestId === getManifestId);
        assert.equal(getContract?.authMode, "bearer");
        assert.deepEqual(getContract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "ApplicationAssetsResponse"]);
        assert.deepEqual(getContract?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);

        const deleteContract = contractTests.contracts?.find((entry) => entry.manifestId === deleteManifestId);
        assert.equal(deleteContract?.authMode, "bearer");
        assert.deepEqual(deleteContract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(deleteContract?.routeMetadata?.responseStatuses, [204, 401, 403, 404]);
    });
});

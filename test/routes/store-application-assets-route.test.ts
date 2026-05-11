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
    createApplicationStoreAssetRouter,
    deleteApplicationStoreAsset,
    getApplicationStoreAssetStoragePath,
    normalizeStoreAssetRouteId,
    UNKNOWN_APPLICATION_STORE_ASSET,
    type ApplicationStoreAssetDeleteDependencies,
    type ApplicationStoreAssetRecord,
} from "../../src/api/routes/store/applications/#application_id/assets/#asset_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:DELETE:/store/applications/:application_id/assets/:asset_id/";
const assignedPath = "/store/applications/{application_id}/assets/{asset_id}";
const assignedRouteName = "DELETE_STORE_APPLICATIONS_APPLICATION_ID_ASSETS_ASSET_ID";
const applicationId = "100000000000000001";
const missingApplicationId = "100000000000000002";
const assetId = "100000000000000003";
const missingAssetId = "100000000000000004";

type JsonSchema = {
    $ref?: string;
    type?: string;
};

type ApplicationAuthorizationTarget = Awaited<ReturnType<NonNullable<ApplicationStoreAssetDeleteDependencies["applicationRepository"]>["findOne"]>>;

function createApplicationRepository(t: TestContext, application: ApplicationAuthorizationTarget = { owner: { id: "owner" } }) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => application),
    };
}

function createAssetRepository(t: TestContext, initialAsset: ApplicationStoreAssetRecord | null) {
    let storedAsset = initialAsset ? { ...initialAsset } : null;
    const deleteMock = t.mock.fn(async (_criteria: unknown) => {
        storedAsset = null;
        return { affected: 1 };
    });

    return {
        findOne: t.mock.fn(async (_options: unknown) => (storedAsset ? { ...storedAsset } : null)),
        delete: deleteMock,
        deleteMock,
    };
}

function createRouteApp(userId: string, dependencies: ApplicationStoreAssetDeleteDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/store/applications/:application_id/assets/:asset_id", createApplicationStoreAssetRouter(dependencies));
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

describe("DELETE /store/applications/:application_id/assets/:asset_id", () => {
    test("declares authenticated ownership-scoped behavior for only the assigned store asset route", () => {
        assert.equal(isNoAuthorizationRoute("DELETE", `/store/applications/${applicationId}/assets/${assetId}`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/api/v10/store/applications/${applicationId}/assets/${assetId}.png`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/store/applications/${applicationId}/assets`), false);
        assert.equal(isNoAuthorizationRoute("POST", `/store/applications/${applicationId}/assets`), false);
        assert.equal(isNoAuthorizationRoute("DELETE", `/oauth2/applications/${applicationId}/assets/${assetId}`), false);
    });

    test("deletes a stored application store asset, accepts xHyroM extension-style IDs, and removes the backing file", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const assetRepository = createAssetRepository(t, { id: assetId, application_id: applicationId });
        const deletedFiles: string[] = [];
        const deleteAssetFile = t.mock.fn(async (path: string) => deletedFiles.push(path));

        assert.equal(normalizeStoreAssetRouteId(`${assetId}.png`), assetId);
        assert.equal(getApplicationStoreAssetStoragePath(applicationId, assetId), `/store-assets/${applicationId}/${assetId}`);
        assert.equal(
            await deleteApplicationStoreAsset(applicationId, `${assetId}.png`, "owner", {
                applicationRepository,
                assetRepository,
                deleteAssetFile,
            }),
            true,
        );

        assert.deepEqual(assetRepository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: assetId,
                application_id: applicationId,
            },
        });
        assert.deepEqual(assetRepository.deleteMock.mock.calls[0].arguments[0], {
            id: assetId,
            application_id: applicationId,
        });
        assert.deepEqual(deletedFiles, [`/store-assets/${applicationId}/${assetId}`]);
    });

    test("returns 204 for accepted owning-team members without a response body", async (t) => {
        const applicationRepository = createApplicationRepository(t, {
            owner: { id: "owner" },
            team: {
                members: [
                    {
                        user_id: "team-member",
                        membership_state: TeamMemberState.ACCEPTED,
                        role: TeamMemberRole.READ_ONLY,
                    },
                ],
            },
        });
        const assetRepository = createAssetRepository(t, { id: assetId, application_id: applicationId });
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const response = await requestRaw(
            createRouteApp("team-member", { applicationRepository, assetRepository, deleteAssetFile }),
            `/store/applications/${applicationId}/assets/${assetId}`,
        );

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.equal(assetRepository.deleteMock.mock.callCount(), 1);
        assert.equal(deleteAssetFile.mock.callCount(), 1);
    });

    test("returns 403 before looking up assets for callers outside the owning application or team", async (t) => {
        const applicationRepository = createApplicationRepository(t, { owner: { id: "owner" } });
        const assetRepository = createAssetRepository(t, { id: assetId, application_id: applicationId });
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const response = await requestRaw(
            createRouteApp("intruder", { applicationRepository, assetRepository, deleteAssetFile }),
            `/store/applications/${applicationId}/assets/${assetId}`,
        );

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(assetRepository.findOne.mock.callCount(), 0);
        assert.equal(assetRepository.deleteMock.mock.callCount(), 0);
        assert.equal(deleteAssetFile.mock.callCount(), 0);
    });

    test("returns source-compatible 404 errors for unknown applications and missing store assets", async (t) => {
        const missingApplicationRepository = createApplicationRepository(t, null);
        const skippedAssetRepository = createAssetRepository(t, { id: assetId, application_id: applicationId });
        const skippedDeleteAssetFile = t.mock.fn(async (_path: string) => undefined);
        const unknownApplicationResponse = await requestRaw(
            createRouteApp("owner", {
                applicationRepository: missingApplicationRepository,
                assetRepository: skippedAssetRepository,
                deleteAssetFile: skippedDeleteAssetFile,
            }),
            `/store/applications/${missingApplicationId}/assets/${assetId}`,
        );

        const applicationRepository = createApplicationRepository(t);
        const missingAssetRepository = createAssetRepository(t, null);
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);
        const unknownAssetResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, assetRepository: missingAssetRepository, deleteAssetFile }),
            `/store/applications/${applicationId}/assets/${missingAssetId}`,
        );

        assert.equal(unknownApplicationResponse.status, 404);
        assert.deepEqual(unknownApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(skippedAssetRepository.findOne.mock.callCount(), 0);
        assert.equal(skippedDeleteAssetFile.mock.callCount(), 0);

        assert.equal(unknownAssetResponse.status, 404);
        assert.deepEqual(unknownAssetResponse.body, {
            code: UNKNOWN_APPLICATION_STORE_ASSET.code,
            message: UNKNOWN_APPLICATION_STORE_ASSET.message,
        });
        assert.equal(missingAssetRepository.deleteMock.mock.callCount(), 0);
        assert.equal(deleteAssetFile.mock.callCount(), 0);
    });

    test("validates malformed route IDs before mutating store asset persistence", async (t) => {
        const applicationRepository = createApplicationRepository(t);
        const assetRepository = createAssetRepository(t, { id: assetId, application_id: applicationId });
        const deleteAssetFile = t.mock.fn(async (_path: string) => undefined);

        const invalidApplicationResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, assetRepository, deleteAssetFile }),
            `/store/applications/not-a-snowflake/assets/${assetId}`,
        );
        const invalidAssetResponse = await requestRaw(
            createRouteApp("owner", { applicationRepository, assetRepository, deleteAssetFile }),
            `/store/applications/${applicationId}/assets/not-a-snowflake`,
        );

        assert.equal(invalidApplicationResponse.status, 404);
        assert.deepEqual(invalidApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(invalidAssetResponse.status, 404);
        assert.deepEqual(invalidAssetResponse.body, {
            code: UNKNOWN_APPLICATION_STORE_ASSET.code,
            message: UNKNOWN_APPLICATION_STORE_ASSET.message,
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 0);
        assert.equal(assetRepository.findOne.mock.callCount(), 0);
        assert.equal(assetRepository.deleteMock.mock.callCount(), 0);
        assert.equal(deleteAssetFile.mock.callCount(), 0);
    });

    test("declares generated artifacts for the exact assigned route and removes the missing entry", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "applications", "#application_id", "assets", "#asset_id.ts"), "utf8");
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
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

        assert.match(routeSource, /summary:\s*"Delete Application Store Asset"/);
        assert.match(routeSource, /204:\s*\{\}/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const route = openapi.paths?.["/store/applications/{application_id}/assets/{asset_id}/"]?.delete;
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.responses?.["204"]?.content, undefined);
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.path, "/store/applications/:application_id/assets/:asset_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/store/applications/#application_id/assets/#asset_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [204, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "DELETE" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/store/applications/#application_id/assets/#asset_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "DELETE" && entry.route === "/store/applications/{param}/assets/{param}" && entry.route_name === assignedRouteName,
            ),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === "/oauth2/applications/{param}/assets/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/store/applications/{param}/assets"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/store/applications/{param}/assets"),
            true,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 401, 403, 404]);
    });
});

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
import express from "express";
import socialSDKReleasesRouter, {
    UNKNOWN_SOCIAL_SDK_RELEASE,
    createSocialSDKReleasesRouter,
    getSocialSDKRelease,
    getSocialSDKReleases,
} from "../../src/api/routes/social-sdk/releases";

const collectionManifestId = "api:http:GET:/social-sdk/releases/";
const detailManifestId = "api:http:GET:/social-sdk/releases/:sdk_release_version";
const sdkRelease = {
    version: "1.2.8730",
    release_date_time: "2025-05-08T12:00:00+00:00",
    artifacts: [
        {
            download_url: "https://example.invalid/social-sdk-1.2.8730.zip",
            filename: "social-sdk-1.2.8730.zip",
            size_bytes: 12345,
        },
    ],
};

describe("GET /social-sdk/releases", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(collectionManifestId, "api:http:GET:/social-sdk/releases/");
        assert.equal(detailManifestId, "api:http:GET:/social-sdk/releases/:sdk_release_version");
    });

    test("returns a conservative empty Social SDK release catalog", () => {
        assert.deepEqual(getSocialSDKReleases(), {
            releases: [],
            latest_version: "",
        });
        assert.notEqual(getSocialSDKReleases().releases, getSocialSDKReleases().releases, "callers should receive a fresh releases array");
        assert.equal(getSocialSDKRelease("1.2.8730"), null);
    });

    test("maps provider-backed release data into list and detail response shapes", () => {
        const catalogProvider = () => ({
            releases: [sdkRelease],
            latest_version: sdkRelease.version,
        });

        assert.deepEqual(getSocialSDKReleases(catalogProvider), {
            releases: [
                {
                    version: sdkRelease.version,
                    release_date_time: sdkRelease.release_date_time,
                },
            ],
            latest_version: sdkRelease.version,
        });
        assert.deepEqual(getSocialSDKRelease(sdkRelease.version, catalogProvider), sdkRelease);
    });

    test("returns the documented empty response for authenticated requests", async () => {
        const response = await requestJson(createAuthenticatedRouteApp(), "/social-sdk/releases");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            releases: [],
            latest_version: "",
        });
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    });

    test("returns a provider-backed release detail for authenticated requests", async () => {
        const response = await requestJson(
            createAuthenticatedRouteApp(
                createSocialSDKReleasesRouter(() => ({
                    releases: [sdkRelease],
                    latest_version: sdkRelease.version,
                })),
            ),
            `/social-sdk/releases/${sdkRelease.version}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sdkRelease);
        assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
    });

    test("returns 404 instead of fabricated release metadata without durable release storage", async () => {
        const response = await requestJson(createAuthenticatedRouteApp(), "/social-sdk/releases/1.2.8730");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: UNKNOWN_SOCIAL_SDK_RELEASE.code,
            message: UNKNOWN_SOCIAL_SDK_RELEASE.message,
        });
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/social-sdk/releases"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/social-sdk/releases/"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/social-sdk/releases/1.2.8730"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/social-sdk/releases"), false);

        const response = await requestJson(createAuthenticationBoundaryApp(), "/social-sdk/releases");
        const detailResponse = await requestJson(createAuthenticationBoundaryApp(), "/social-sdk/releases/1.2.8730");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(detailResponse.status, 401);
        assert.equal((detailResponse.body as { code?: unknown }).code, 401);
    });

    test("declares source-backed route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "social-sdk", "releases.ts"), "utf8");

        assert.match(routeSource, /router\.get\(\s*"\/"/);
        assert.match(routeSource, /summary:\s*"Get Social SDK Releases"/);
        assert.match(routeSource, /description:\s*"Returns the currently available social SDK releases\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"SocialSDKReleasesResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /router\.get\(\s*"\/:sdk_release_version"/);
        assert.match(routeSource, /summary:\s*"Get Social SDK Release"/);
        assert.match(routeSource, /description:\s*"Returns a social SDK release object for the given version\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"SocialSDKRelease"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates schema, source catalog, OpenAPI, manifest, and contract artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as SourceCatalogEntry[];
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as OpenApiDocument;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as TestingManifest;
        const contracts = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as ContractMatrix;
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as MissingRouteReport;

        const responseSchema = schemas.SocialSDKReleasesResponse;
        assert.deepEqual(responseSchema.required?.sort(), ["latest_version", "releases"]);
        assert.equal(responseSchema.properties?.latest_version?.type, "string");
        assert.equal(responseSchema.properties?.releases?.type, "array");
        assert.equal(responseSchema.properties?.releases?.items?.$ref, "#/definitions/SocialSDKRelease");

        const releaseSchema = schemas.SocialSDKRelease;
        assert.deepEqual(releaseSchema.required?.sort(), ["release_date_time", "version"]);
        assert.equal(releaseSchema.properties?.version?.type, "string");
        assert.equal(releaseSchema.properties?.release_date_time?.type, "string");
        assert.equal(releaseSchema.properties?.artifacts?.items?.$ref, "#/definitions/SocialSDKReleaseArtifact");

        const artifactSchema = schemas.SocialSDKReleaseArtifact;
        assert.deepEqual(artifactSchema.required?.sort(), ["download_url", "filename", "size_bytes"]);
        assert.equal(artifactSchema.properties?.download_url?.type, "string");
        assert.equal(artifactSchema.properties?.filename?.type, "string");
        assert.equal(artifactSchema.properties?.size_bytes?.type, "integer");

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/social-sdk/releases");
        assert.equal(catalogEntry?.route_name, "GET_SOCIAL_SDK_RELEASES");
        assert.equal(catalogEntry?.source, "src/api/routes/social-sdk/releases.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "SocialSDKReleasesResponse"]);

        const detailCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/social-sdk/releases/{sdk_release_version}");
        assert.equal(detailCatalogEntry?.route_name, "GET_SOCIAL_SDK_RELEASES_SDK_RELEASE_VERSION");
        assert.equal(detailCatalogEntry?.source, "src/api/routes/social-sdk/releases.ts");
        assert.deepEqual(detailCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "SocialSDKRelease"]);
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "GET" && entry.route === "/social-sdk/releases/{param}" && entry.route_name === "GET_SOCIAL_SDK_RELEASES_SDK_RELEASE_VERSION",
            ),
            false,
        );

        const collectionRoute = openapi.paths?.["/social-sdk/releases/"]?.get;
        assert.equal(collectionRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SocialSDKReleasesResponse");
        assert.equal(collectionRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(collectionRoute?.security, [{ bearer: [] }]);

        const detailRoute = openapi.paths?.["/social-sdk/releases/{sdk_release_version}"]?.get;
        assert.equal(
            detailRoute?.parameters?.some((parameter) => parameter.name === "sdk_release_version" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(detailRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SocialSDKRelease");
        assert.equal(detailRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(detailRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(detailRoute?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === collectionManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/social-sdk/releases.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("SocialSDKReleasesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const detailManifestEntry = manifest.entries?.find((entry) => entry.id === detailManifestId);
        assert.equal(detailManifestEntry?.authMode, "bearer");
        assert.equal(detailManifestEntry?.sourceFile, "src/api/routes/social-sdk/releases.ts");
        assert.equal(detailManifestEntry?.routeMetadata?.responseBodies?.includes("SocialSDKRelease"), true);
        assert.equal(detailManifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            detailManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === collectionManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.responses?.includes("SocialSDKReleasesResponse"), true);
        assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const detailContract = contracts.contracts?.find((entry) => entry.manifestId === detailManifestId);
        assert.equal(detailContract?.authMode, "bearer");
        assert.equal(detailContract?.routeMetadata?.responses?.includes("SocialSDKRelease"), true);
        assert.equal(detailContract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            detailContract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401, 404],
        );
    });
});

function createAuthenticatedRouteApp(router: express.Router = socialSDKReleasesRouter) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/social-sdk/releases", router);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticationBoundaryApp() {
    const app = express();

    app.use(Authentication);
    app.use("/social-sdk/releases", socialSDKReleasesRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
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
    type?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

type SourceCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type MissingRouteReport = {
    missing_entries?: { method?: string; route?: string; route_name?: string }[];
};

type ContractMatrix = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

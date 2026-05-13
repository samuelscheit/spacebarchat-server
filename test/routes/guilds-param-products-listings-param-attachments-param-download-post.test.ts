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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import guildProductAttachmentDownloadRouter, {
    GUILD_PRODUCT_ATTACHMENT_MISSING_ACCESS_ERROR,
    UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR,
    createGuildProductAttachmentDownloadRouter,
    getConfiguredGuildProductAttachmentDownload,
    getGuildProductAttachmentDownload,
    isGuildProductAttachmentDownloadRouteSnowflake,
    toGuildProductAttachmentDownloadResponse,
    type GuildProductAttachmentDownloadProvider,
    type GuildProductAttachmentDownloadProviderOptions,
    type GuildProductAttachmentDownloadSource,
} from "../../src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download";

const coveredManifestId = "api:http:POST:/guilds/:guild_id/products/listings/:listing_id/attachments/:attachment_id/download/";
const assignedMissingPath = "/guilds/{param}/products/listings/{param}/attachments/{param}/download";
const assignedSourcePath = "/guilds/{guild_id}/products/listings/{listing_id}/attachments/{attachment_id}/download";
const assignedUpstreamRouteName = "GUILD_PRODUCT_ATTACHMENT_DOWNLOAD";
const assignedSourceRouteName = "POST_GUILDS_GUILD_ID_PRODUCTS_LISTINGS_LISTING_ID_ATTACHMENTS_ATTACHMENT_ID_DOWNLOAD";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

describe("POST /guilds/:guild_id/products/listings/:listing_id/attachments/:attachment_id/download", () => {
    test("declares the assigned manifest route id and remains bearer-authenticated", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/guilds/:guild_id/products/listings/:listing_id/attachments/:attachment_id/download/");
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/guilds/100000000000000001/products/listings/200000000000000001/attachments/300000000000000001/download"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/guilds/100000000000000001/products/listings/200000000000000001/attachments/300000000000000001/download"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), routePath());

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.match(String(response.body.message), /Missing Authorization Header/);
    });

    test("returns a provider-backed signed URL for the exact guild listing attachment tuple", async () => {
        let receivedOptions: GuildProductAttachmentDownloadProviderOptions | undefined;
        const provider: GuildProductAttachmentDownloadProvider = (options) => {
            receivedOptions = options;
            return sampleDownload;
        };

        const response = await requestJson(createRouteApp({ provider }), routePath());

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            guild_id: sampleDownload.guild_id,
            listing_id: sampleDownload.listing_id,
            attachment_id: sampleDownload.attachment_id,
            user_id: "100000000000000004",
        });
        assert.deepEqual(response.body, {
            url: sampleDownload.url,
        });
    });

    test("fails closed for malformed IDs, unbacked attachments, mismatched provider data, and invalid URLs", async () => {
        let providerCalled = false;

        assert.equal(isGuildProductAttachmentDownloadRouteSnowflake("100000000000000001"), true);
        assert.equal(isGuildProductAttachmentDownloadRouteSnowflake("not-a-snowflake"), false);
        assert.deepEqual(
            getConfiguredGuildProductAttachmentDownload({
                guild_id: sampleDownload.guild_id,
                listing_id: sampleDownload.listing_id,
                attachment_id: sampleDownload.attachment_id,
                user_id: "100000000000000004",
            }),
            undefined,
        );
        await assert.rejects(
            () =>
                getGuildProductAttachmentDownload(
                    {
                        guild_id: "not-a-snowflake",
                        listing_id: sampleDownload.listing_id,
                        attachment_id: sampleDownload.attachment_id,
                        user_id: "100000000000000004",
                    },
                    () => {
                        providerCalled = true;
                        return sampleDownload;
                    },
                ),
            isUnknownGuildProductAttachmentError,
        );
        assert.equal(providerCalled, false);
        await assert.rejects(() => getGuildProductAttachmentDownload(requestOptions(), () => undefined), isUnknownGuildProductAttachmentError);
        await assert.rejects(
            () =>
                getGuildProductAttachmentDownload(requestOptions(), () => ({
                    ...sampleDownload,
                    attachment_id: "300000000000000002",
                })),
            isUnknownGuildProductAttachmentError,
        );
        await assert.rejects(
            () =>
                getGuildProductAttachmentDownload(requestOptions(), () => ({
                    ...sampleDownload,
                    url: "javascript:alert(1)",
                })),
            isUnknownGuildProductAttachmentError,
        );

        const missingResponse = await requestJson(createRouteApp(), routePath());
        const invalidResponse = await requestJson(createRouteApp({ provider: () => sampleDownload }), routePath({ listingId: "not-a-snowflake" }));

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR.code,
            message: UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR.message,
        });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR.code,
            message: UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR.message,
        });
    });

    test("lets provider-backed entitlement checks deny access without leaking a download URL", async () => {
        const response = await requestJson(
            createRouteApp({
                provider: () => {
                    throw GUILD_PRODUCT_ATTACHMENT_MISSING_ACCESS_ERROR;
                },
            }),
            routePath(),
        );

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: GUILD_PRODUCT_ATTACHMENT_MISSING_ACCESS_ERROR.code,
            message: GUILD_PRODUCT_ATTACHMENT_MISSING_ACCESS_ERROR.message,
        });
    });

    test("serializes only the documented download URL field", () => {
        const source = {
            ...sampleDownload,
            internal_storage_key: "do-not-leak",
        } as GuildProductAttachmentDownloadSource & { internal_storage_key: string };

        const response = toGuildProductAttachmentDownloadResponse(source);

        assert.deepEqual(response, { url: sampleDownload.url });
        assert.equal((response as { internal_storage_key?: unknown }).internal_storage_key, undefined);
    });

    test("documents source-backed metadata and generated artifacts for only the assigned POST route", () => {
        const routeSource = readFileSync(
            path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "products", "listings", "#listing_id", "attachments", "#attachment_id", "download.ts"),
            "utf8",
        );
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: {
                method?: string;
                route?: string;
                route_name?: string;
            }[];
        }>(path.join("packages", "missing-routes", "missing.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Create Guild Product Attachment Download URL"/);
        assert.match(routeSource, /fails closed instead of fabricating downloadable product files/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildProductAttachmentDownloadResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete|options|head)\(/);

        assert.equal(schemas.GuildProductAttachmentDownloadResponse.type, "object");
        assert.deepEqual(schemas.GuildProductAttachmentDownloadResponse.required, ["url"]);
        assert.equal(schemas.GuildProductAttachmentDownloadResponse.properties?.url?.type, "string");

        const operation = openapi.paths?.["/guilds/{guild_id}/products/listings/{listing_id}/attachments/{attachment_id}/download/"]?.post;
        assert.equal(operation?.summary, "Create Guild Product Attachment Download URL");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        for (const parameterName of ["guild_id", "listing_id", "attachment_id"]) {
            assert.equal(
                operation?.parameters?.some((parameter) => parameter.name === parameterName && parameter.in === "path" && parameter.required === true),
                true,
            );
        }
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildProductAttachmentDownloadResponse");
        for (const status of ["401", "403", "404"]) {
            assert.equal(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.equal(openapi.paths?.["/guilds/{guild_id}/products/listings/{listing_id}/attachments/{attachment_id}/download/"]?.get, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/guilds/:guild_id/products/listings/:listing_id/attachments/:attachment_id/download/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "GuildProductAttachmentDownloadResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedSourcePath);
        assert.deepEqual(sourceEntry, {
            method: "POST",
            response_schema_refs: ["APIErrorResponse", "GuildProductAttachmentDownloadResponse"],
            route: assignedSourcePath,
            route_name: assignedSourceRouteName,
            source: "src/api/routes/guilds/#guild_id/products/listings/#listing_id/attachments/#attachment_id/download.ts",
        });
        assert.equal(
            sourceCatalog.some((entry) => entry.route === assignedSourcePath && entry.method !== "POST"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedMissingPath && entry.route_name === assignedUpstreamRouteName),
            false,
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "GuildProductAttachmentDownloadResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);
    });
});

const sampleDownload: GuildProductAttachmentDownloadSource = {
    guild_id: "100000000000000001",
    listing_id: "200000000000000001",
    attachment_id: "300000000000000001",
    url: "https://cdn.example.test/guild-products/100000000000000001/300000000000000001.zip?signature=test",
};

function requestOptions(): GuildProductAttachmentDownloadProviderOptions {
    return {
        guild_id: sampleDownload.guild_id,
        listing_id: sampleDownload.listing_id,
        attachment_id: sampleDownload.attachment_id,
        user_id: "100000000000000004",
    };
}

function isUnknownGuildProductAttachmentError(error: unknown) {
    return error === UNKNOWN_GUILD_PRODUCT_ATTACHMENT_ERROR;
}

function routePath(options: { guildId?: string; listingId?: string; attachmentId?: string } = {}) {
    const guildId = options.guildId ?? sampleDownload.guild_id;
    const listingId = options.listingId ?? sampleDownload.listing_id;
    const attachmentId = options.attachmentId ?? sampleDownload.attachment_id;
    return `/guilds/${guildId}/products/listings/${listingId}/attachments/${attachmentId}/download`;
}

function createRouteApp(options: { authentication?: boolean; provider?: GuildProductAttachmentDownloadProvider } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000004";
            next();
        });
    }
    app.use(
        "/guilds/:guild_id/products/listings/:listing_id/attachments/:attachment_id/download",
        options.provider ? createGuildProductAttachmentDownloadRouter(options.provider) : guildProductAttachmentDownloadRouter,
    );
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = await listen(app);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "POST",
        });
        const text = await response.text();

        return {
            status: response.status,
            body: text ? JSON.parse(text) : undefined,
        };
    } finally {
        await close(server);
    }
}

function listen(app: express.Express): Promise<Server> {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, "127.0.0.1", () => resolve(server));
        server.on("error", reject);
    });
}

function close(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}

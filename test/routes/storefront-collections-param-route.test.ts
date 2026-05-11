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
import type { StorefrontCollectionResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createStorefrontCollectionRouter,
    getConfiguredStorefrontCollection,
    getStorefrontCollection,
    parseStorefrontCollectionQuery,
    toStorefrontCollectionResponse,
    UNKNOWN_STOREFRONT_COLLECTION_ERROR,
    type StorefrontCollectionProvider,
    type StorefrontCollectionProviderOptions,
    type StorefrontCollectionSource,
} from "../../src/api/routes/storefront/collections/#collection_id";
import type { StorefrontProductSource } from "../../src/api/util/utility/StorefrontProductRoute";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/storefront/collections/:collection_id/"];
const assignedPath = "/storefront/collections/{param}";
const assignedSourcePath = "/storefront/collections/{collection_id}";
const assignedRouteName = "GET_STOREFRONT_COLLECTIONS_COLLECTION_ID";

const collectionId = "1458532555463589977";
const applicationId = "1340102344645283891";
const productId = "1458532555463589978";
const secondProductId = "1458532555463589980";
const missingProductId = "1458532555463589982";
const guildId = "1346069614634864772";

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /storefront/collections/:collection_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth without exposing adjacent storefront routes", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/storefront/collections/:collection_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/storefront/collections/${collectionId}`), false);
        assert.equal(isNoAuthorizationRoute("HEAD", `/api/v10/storefront/collections/${collectionId}/`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v10/storefront/products/${productId}`), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/storefront/products/skus?sku_ids=300000000000000002"), false);

        const response = await requestJson(createAuthenticatedApp(), `/storefront/collections/${collectionId}`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("parses query options and rejects malformed booleans or storefront IDs", () => {
        assert.deepEqual(
            parseStorefrontCollectionQuery({
                country_code: ["DE"],
                guild_id: [guildId],
                include_unpublished_products: "true",
                include_unpublished_collection: "0",
            } as never),
            {
                country_code: "DE",
                guild_id: guildId,
                include_unpublished_products: true,
                include_unpublished_collection: false,
            },
        );

        assert.throws(() => parseStorefrontCollectionQuery({ guild_id: "not-a-snowflake" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parseStorefrontCollectionQuery({ include_unpublished_products: "sometimes" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
    });

    test("passes parsed query options to the local provider and returns collection products in collection order", async () => {
        let providerOptions: StorefrontCollectionProviderOptions | undefined;
        const source = storefrontCollectionSource();
        const provider: StorefrontCollectionProvider = (options) => {
            providerOptions = options;
            return source;
        };

        const response = await requestJson(
            createRouteApp(provider),
            `/storefront/collections/${collectionId}?country_code=DE&guild_id=${guildId}&include_unpublished_products=1&include_unpublished_collection=false`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(providerOptions, {
            collection_id: collectionId,
            country_code: "DE",
            guild_id: guildId,
            include_unpublished_products: true,
            include_unpublished_collection: false,
        });
        assert.deepEqual(response.body, toStorefrontCollectionResponse(source));
        assert.deepEqual(
            (response.body as StorefrontCollectionResponse).products.map((product) => product.id),
            [secondProductId, productId],
        );
    });

    test("fails closed for malformed, missing, or mismatched collection IDs without fabricating storefront data", async () => {
        assert.equal(getConfiguredStorefrontCollection({ collection_id: collectionId }), undefined);
        assert.equal(UNKNOWN_STOREFRONT_COLLECTION_ERROR.httpStatus, 404);
        assert.equal(UNKNOWN_STOREFRONT_COLLECTION_ERROR.code, 10121);

        await assert.rejects(() => getStorefrontCollection("not-a-snowflake", {}, () => storefrontCollectionSource()), isUnknownCollectionError);
        await assert.rejects(() => getStorefrontCollection(collectionId, {}, () => undefined), isUnknownCollectionError);
        await assert.rejects(
            () =>
                getStorefrontCollection(collectionId, {}, () => ({
                    ...storefrontCollectionSource(),
                    collection: {
                        ...storefrontCollectionSource().collection,
                        id: "1458532555463589999",
                    },
                })),
            isUnknownCollectionError,
        );

        const missingResponse = await requestJson(createRouteApp(), `/storefront/collections/${collectionId}`);
        const invalidResponse = await requestJson(
            createRouteApp(() => storefrontCollectionSource()),
            "/storefront/collections/not-a-snowflake",
        );

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, {
            code: UNKNOWN_STOREFRONT_COLLECTION_ERROR.code,
            message: UNKNOWN_STOREFRONT_COLLECTION_ERROR.message,
        });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, {
            code: UNKNOWN_STOREFRONT_COLLECTION_ERROR.code,
            message: UNKNOWN_STOREFRONT_COLLECTION_ERROR.message,
        });
    });

    test("serializes documented collection fields and product responses without leaking provider internals", () => {
        const source = storefrontCollectionSource() as StorefrontCollectionSource & { collection: StorefrontCollectionSource["collection"] & { internal_notes?: string } };
        source.collection.internal_notes = "do not leak";

        const response = toStorefrontCollectionResponse(source) as StorefrontCollectionResponse & {
            collection: StorefrontCollectionResponse["collection"] & { internal_notes?: unknown };
        };

        assert.deepEqual(Object.keys(response.collection).sort(), ["application_id", "created_at", "description", "id", "name", "product_ids", "tenant_metadata", "updated_at"]);
        assert.equal(response.collection.internal_notes, undefined);
        assert.deepEqual(response.collection.product_ids, [secondProductId, productId, missingProductId]);
        assert.deepEqual(
            response.products.map((product) => product.id),
            [secondProductId, productId],
        );
        assert.equal(
            response.products.some((product) => product.id === missingProductId),
            false,
        );

        source.collection.product_ids.push("1458532555463589990");
        source.products[1]?.skus[0]?.tenant_metadata.plan_features.push({ title: "Mutated", description: "Should not appear" });

        assert.deepEqual(response.collection.product_ids, [secondProductId, productId, missingProductId]);
        assert.deepEqual(response.products[0]?.skus[0]?.tenant_metadata.plan_features, [{ title: "Slots", description: "More player slots" }]);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "storefront", "collections", "#collection_id.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: {
                schemas?: Record<string, JsonSchema>;
            };
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

        assert.match(routeSource, /summary:\s*"Get Storefront Collection"/);
        assert.match(routeSource, /description:\s*"Returns the locally backed storefront collection and locally backed products for the given collection ID\."/);
        assert.match(routeSource, /country_code:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /guild_id:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /include_unpublished_products:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /include_unpublished_collection:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StorefrontCollectionResponse"/s);
        for (const status of ["400", "401", "404"]) {
            assert.match(routeSource, new RegExp(`${status}:\\s*\\{\\s*body:\\s*"APIErrorResponse"`, "s"));
        }

        assert.equal(schemas.StorefrontCollectionResponse.type, "object");
        assert.deepEqual(schemas.StorefrontCollectionResponse.required?.sort(), ["collection", "products"]);
        assert.equal(schemas.StorefrontCollectionResponse.properties?.collection?.$ref, "#/definitions/StorefrontCollection");
        assert.equal(schemas.StorefrontCollectionResponse.properties?.products?.items?.$ref, "#/definitions/StorefrontProductResponse");
        assert.deepEqual(schemas.StorefrontCollection.required?.sort(), [
            "application_id",
            "created_at",
            "description",
            "id",
            "name",
            "product_ids",
            "tenant_metadata",
            "updated_at",
        ]);
        assert.equal(schemas.StorefrontCollection.properties?.product_ids?.items?.type, "string");
        assert.equal(schemas.StorefrontProductResponse.properties?.skus?.items?.$ref, "#/definitions/StorefrontProductSku");

        const route = openapi.paths?.["/storefront/collections/{collection_id}/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "collection_id" && parameter.in === "path" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "country_code" && parameter.in === "query" && parameter.schema?.type === "string"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "guild_id" && parameter.in === "query" && parameter.schema?.type === "string"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "include_unpublished_products" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "include_unpublished_collection" && parameter.in === "query" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StorefrontCollectionResponse");
        for (const status of ["400", "401", "404"]) {
            assert.equal(route?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.components?.schemas?.StorefrontCollectionResponse?.properties?.products?.items?.$ref, "#/components/schemas/StorefrontProductResponse");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/storefront/collections/:collection_id/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/storefront/collections/#collection_id.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StorefrontCollectionResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/storefront/collections/#collection_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StorefrontCollectionResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "StorefrontCollectionResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);
    });
});

function isUnknownCollectionError(error: unknown) {
    return (
        (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_STOREFRONT_COLLECTION_ERROR.code &&
        (error as { message?: unknown })?.message === UNKNOWN_STOREFRONT_COLLECTION_ERROR.message
    );
}

function storefrontCollectionSource(): StorefrontCollectionSource {
    return {
        collection: {
            id: collectionId,
            application_id: applicationId,
            name: "Server Hosting",
            description: "Managed game server powerups.",
            product_ids: [secondProductId, productId, missingProductId],
            created_at: "2026-01-07T18:47:39.455084+00:00",
            updated_at: "2026-02-27T18:40:56.037576+00:00",
            tenant_metadata: {
                surface: "storefront",
            },
        },
        products: [storefrontProduct(productId, "1458532555463589979"), storefrontProduct(secondProductId, "1460419709630677042")],
    };
}

function storefrontProduct(id: string, skuId: string): StorefrontProductSource {
    return {
        id,
        application_id: applicationId,
        sku_ids: [skuId],
        skus: [
            {
                id: skuId,
                type: 2,
                product_line: 13,
                application_id: applicationId,
                name: "Starter Plan",
                thumbnail_asset_id: null,
                slug: "starter-plan",
                premium: false,
                selected_options: [{ option_name: "Memory", option_value: "5" }],
                product_id: id,
                position: 0,
                tenant_metadata: {
                    boost_price: 5,
                    purchase_limit: 1,
                    category_type: "game_server",
                    plan_features: [{ title: "Slots", description: "More player slots" }],
                },
            },
        ],
        name: "Game Server",
        options: [{ name: "Memory", option_values: ["5"] }],
        created_at: "2026-01-07T18:47:39.455084+00:00",
        updated_at: "2026-02-27T18:40:56.037576+00:00",
        tenant_metadata: {},
    };
}

function createRouteApp(collectionProvider: StorefrontCollectionProvider = getConfiguredStorefrontCollection) {
    const app = express();

    app.use("/storefront/collections/:collection_id", createStorefrontCollectionRouter(collectionProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/storefront/collections/:collection_id", createStorefrontCollectionRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

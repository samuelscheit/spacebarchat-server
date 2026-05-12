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
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import type { StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createPartnerSdkApplicationSkuRecommendationsRouter,
    getConfiguredPartnerSdkApplicationSkuRecommendations,
    getPartnerSdkApplicationSkuRecommendations,
    isPartnerSdkApplicationSkuRecommendationsSnowflake,
    parsePartnerSdkApplicationSkuRecommendationsQuery,
    toPartnerSdkApplicationSkuRecommendationsResponse,
    type PartnerSdkApplicationSkuRecommendationsApplicationRepository,
    type PartnerSdkApplicationSkuRecommendationsApplicationSource,
    type PartnerSdkApplicationSkuRecommendationsDependencies,
    type PartnerSdkApplicationSkuRecommendationsProvider,
    type PartnerSdkApplicationSkuRecommendationsProviderOptions,
} from "../../src/api/routes/partner-sdk/applications/#application_id/skus/recommendations";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const manifestId = "api:http:GET:/partner-sdk/applications/:application_id/skus/recommendations/";
const routePath = "/partner-sdk/applications/:application_id/skus/recommendations/";
const openApiPath = "/partner-sdk/applications/{application_id}/skus/recommendations/";
const sourceRoute = "/partner-sdk/applications/{application_id}/skus/recommendations";
const assignedRoute = "/partner-sdk/applications/{param}/skus/recommendations";
const assignedRouteName = "GET_PARTNER_SDK_APPLICATIONS_APPLICATION_ID_SKUS_RECOMMENDATIONS";

type JsonResponse = {
    status: number;
    body: Record<string, unknown> | unknown[];
};

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    additionalProperties?: JsonSchema;
    enum?: unknown[];
};

describe("GET /partner-sdk/applications/:application_id/skus/recommendations", () => {
    test("parses documented query forms and returns provider-backed recommendations", async (t) => {
        const applicationRepository = createApplicationRepository(t, sampleApplication);
        let receivedOptions: PartnerSdkApplicationSkuRecommendationsProviderOptions | undefined;
        const recommendationsProvider: PartnerSdkApplicationSkuRecommendationsProvider = (options) => {
            receivedOptions = options;
            return {
                skus: [sampleSku, { ...sampleSku, id: "300000000000000002", slug: "second-sku" }],
                skus_to_user_ids: {
                    "300000000000000001": {
                        user_id: "200000000000000001",
                        reason: "WISHLIST",
                    },
                    "300000000000000002": {
                        user_id: "200000000000000099",
                        reason: "RECOMMENDATION",
                    },
                },
            };
        };
        const app = createRouteApp({ applicationRepository, recommendationsProvider });

        assert.deepEqual(
            parsePartnerSdkApplicationSkuRecommendationsQuery({
                user_ids: "200000000000000001,200000000000000002",
                "user_ids[]": ["200000000000000001"],
                max_recommendations: "1",
                include_wishlists: "1",
            } as never),
            {
                user_ids: ["200000000000000001", "200000000000000002"],
                max_recommendations: 1,
                include_wishlists: true,
            },
        );

        const response = await requestJson(
            app,
            "/partner-sdk/applications/100000000000000001/skus/recommendations?user_ids=200000000000000001,200000000000000002&max_recommendations=1&include_wishlists=true",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, {
            application_id: "100000000000000001",
            application: sampleApplication,
            user_ids: ["200000000000000001", "200000000000000002"],
            max_recommendations: 1,
            include_wishlists: true,
        });
        assert.deepEqual(response.body, {
            skus: [sampleSku],
            skus_to_user_ids: {
                "300000000000000001": {
                    user_id: "200000000000000001",
                    reason: "WISHLIST",
                },
            },
            application: sampleApplicationResponse,
        });
    });

    test("returns empty local recommendations without fabricating SKU or wishlist state", async (t) => {
        const query = {
            user_ids: ["200000000000000001"],
            include_wishlists: false,
        };
        const applicationRepository = createApplicationRepository(t, sampleApplication);

        assert.equal(isPartnerSdkApplicationSkuRecommendationsSnowflake("100000000000000001"), true);
        assert.equal(isPartnerSdkApplicationSkuRecommendationsSnowflake("not-a-snowflake"), false);
        assert.deepEqual(
            getConfiguredPartnerSdkApplicationSkuRecommendations({
                application_id: "100000000000000001",
                application: sampleApplication,
                ...query,
            }),
            {
                skus: [],
                skus_to_user_ids: {},
            },
        );

        const first = await getPartnerSdkApplicationSkuRecommendations("100000000000000001", query, { applicationRepository });
        const second = await getPartnerSdkApplicationSkuRecommendations("100000000000000001", query, { applicationRepository });

        assert.deepEqual(first, {
            skus: [],
            skus_to_user_ids: {},
            application: sampleApplicationResponse,
        });
        assert.notEqual(first.skus, second.skus, "callers should receive fresh response arrays");
        assert.notEqual(first.skus_to_user_ids, second.skus_to_user_ids, "callers should receive fresh response maps");
    });

    test("fails closed for malformed queries, malformed applications, and unknown applications", async (t) => {
        const applicationRepository = createApplicationRepository(t, null);
        let providerCalls = 0;
        const recommendationsProvider: PartnerSdkApplicationSkuRecommendationsProvider = () => {
            providerCalls += 1;
            return {
                skus: [sampleSku],
                skus_to_user_ids: {},
            };
        };

        assert.throws(() => parsePartnerSdkApplicationSkuRecommendationsQuery({} as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(() => parsePartnerSdkApplicationSkuRecommendationsQuery({ user_ids: "not-a-snowflake" } as never), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });
        assert.throws(
            () =>
                parsePartnerSdkApplicationSkuRecommendationsQuery({
                    user_ids: "200000000000000001",
                    max_recommendations: "26",
                } as never),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );
        assert.throws(
            () =>
                parsePartnerSdkApplicationSkuRecommendationsQuery({
                    user_ids: "200000000000000001",
                    include_wishlists: "sometimes",
                } as never),
            { code: DiscordApiErrors.INVALID_FORM_BODY.code },
        );

        await assert.rejects(
            () => getPartnerSdkApplicationSkuRecommendations("not-a-snowflake", { user_ids: ["200000000000000001"], include_wishlists: false }, { recommendationsProvider }),
            { code: DiscordApiErrors.UNKNOWN_APPLICATION.code },
        );

        await assert.rejects(
            () =>
                getPartnerSdkApplicationSkuRecommendations(
                    "100000000000000001",
                    { user_ids: ["200000000000000001"], include_wishlists: false },
                    { applicationRepository, recommendationsProvider },
                ),
            { code: DiscordApiErrors.UNKNOWN_APPLICATION.code },
        );
        assert.equal(providerCalls, 0);

        const invalidQueryResponse = await requestJson(
            createRouteApp({ applicationRepository: createApplicationRepository(t, sampleApplication), recommendationsProvider }),
            "/partner-sdk/applications/100000000000000001/skus/recommendations?user_ids=not-a-snowflake",
        );
        const unknownApplicationResponse = await requestJson(
            createRouteApp({ applicationRepository, recommendationsProvider }),
            "/partner-sdk/applications/100000000000000001/skus/recommendations?user_ids=200000000000000001",
        );

        assert.equal(invalidQueryResponse.status, 400);
        assert.equal((invalidQueryResponse.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.equal(unknownApplicationResponse.status, 404);
        assert.deepEqual(unknownApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("serializes only documented application, SKU, and recommendation fields", () => {
        const sourceSku = {
            ...sampleSku,
            bundled_sku_ids: ["300000000000000002"],
            features: [1, 2],
            internal_notes: "do not serialize",
        } as StoreSkuResponse & { internal_notes: string };
        const response = toPartnerSdkApplicationSkuRecommendationsResponse(
            { ...sampleApplication, internal_secret: "do not serialize" } as PartnerSdkApplicationSkuRecommendationsApplicationSource & { internal_secret: string },
            {
                skus: [sourceSku, { ...sampleSku, id: "300000000000000002", slug: "wishlist-sku" }],
                skus_to_user_ids: {
                    "300000000000000001": {
                        user_id: "200000000000000001",
                        reason: "RECOMMENDATION",
                    },
                    "300000000000000002": {
                        user_id: "200000000000000001",
                        reason: "WISHLIST",
                    },
                    "300000000000000003": {
                        user_id: "200000000000000001",
                        reason: "RECOMMENDATION",
                    },
                    "300000000000000004": {
                        user_id: "200000000000000009",
                        reason: "WISHLIST",
                    },
                    "300000000000000005": {
                        user_id: "200000000000000001",
                        reason: "UNKNOWN" as never,
                    },
                },
            },
            { user_ids: ["200000000000000001"], include_wishlists: false },
        );

        assert.deepEqual(response.application, sampleApplicationResponse);
        assert.equal((response.application as typeof sampleApplicationResponse & { internal_secret?: unknown }).internal_secret, undefined);
        assert.deepEqual(response.skus[0].bundled_sku_ids, ["300000000000000002"]);
        assert.equal((response.skus[0] as StoreSkuResponse & { internal_notes?: unknown }).internal_notes, undefined);
        assert.deepEqual(response.skus_to_user_ids, {
            "300000000000000001": {
                user_id: "200000000000000001",
                reason: "RECOMMENDATION",
            },
        });
    });

    test("stays behind bearer authentication and declares route metadata", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/partner-sdk/applications/100000000000000001/skus/recommendations"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/partner-sdk/applications/100000000000000001/skus/recommendations/"), false);

        const authResponse = await requestJson(createAuthenticatedApp(), "/partner-sdk/applications/100000000000000001/skus/recommendations?user_ids=200000000000000001");

        assert.equal(authResponse.status, 401);
        assert.match((authResponse.body as { message?: string }).message ?? "", /Missing Authorization Header/);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "applications", "#application_id", "skus", "recommendations.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Get Application SKU Recommendations"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PartnerSdkApplicationSkuRecommendationsResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("is present in regenerated schemas, catalogs, manifest, contracts, OpenAPI, and removed from missing routes", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openApi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
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

        assert.equal(schemas.PartnerSdkApplicationSkuRecommendationsResponse.type, "object");
        assert.deepEqual(schemas.PartnerSdkApplicationSkuRecommendationsResponse.required?.sort(), ["application", "skus", "skus_to_user_ids"]);
        assert.equal(schemas.PartnerSdkApplicationSkuRecommendationsResponse.properties?.skus?.items?.$ref, "#/definitions/StoreSkuResponse");
        assert.equal(schemas.PartnerSdkApplicationSkuRecommendationsResponse.properties?.application?.$ref, "#/definitions/PartnerSdkApplicationSkuRecommendationApplication");
        assert.equal(schemas.PartnerSdkApplicationSkuRecommendationMap.additionalProperties?.$ref, "#/definitions/PartnerSdkApplicationSkuRecommendation");
        assert.deepEqual(schemas.PartnerSdkApplicationSkuRecommendationReason.enum?.sort(), ["RECOMMENDATION", "WISHLIST"]);

        const operation = openApi.paths?.[openApiPath]?.get;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkApplicationSkuRecommendationsResponse");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, routePath);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PartnerSdkApplicationSkuRecommendationsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === sourceRoute),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PartnerSdkApplicationSkuRecommendationsResponse"],
                route: sourceRoute,
                route_name: assignedRouteName,
                source: "src/api/routes/partner-sdk/applications/#application_id/skus/recommendations.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedRoute && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PartnerSdkApplicationSkuRecommendationsResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 404],
        );
    });
});

const sampleApplication: PartnerSdkApplicationSkuRecommendationsApplicationSource = {
    id: "100000000000000001",
    name: "Space Game",
    description: "Local application",
    icon: "application-icon",
    type: null,
    flags: 64,
};

const sampleApplicationResponse = {
    id: "100000000000000001",
    name: "Space Game",
    description: "Local application",
    icon: "application-icon",
    type: null,
    flags: 64,
};

const sampleSku: StoreSkuResponse = {
    id: "300000000000000001",
    type: 3,
    application_id: "100000000000000001",
    product_line: 14,
    flags: 4,
    name: "Coin Pack",
    slug: "coin-pack",
    access_type: 1,
    features: [],
    premium: false,
    show_age_gate: false,
};

function createApplicationRepository(
    t: TestContext,
    application: PartnerSdkApplicationSkuRecommendationsApplicationSource | null,
): PartnerSdkApplicationSkuRecommendationsApplicationRepository {
    return {
        findOne: t.mock.fn(async (_options) => application),
    };
}

function createRouteApp(dependencies: PartnerSdkApplicationSkuRecommendationsDependencies = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.token = { id: "viewer", iat: 1 } as never;
        next();
    });
    app.use("/partner-sdk/applications/:application_id/skus/recommendations", createPartnerSdkApplicationSkuRecommendationsRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/partner-sdk/applications/:application_id/skus/recommendations", createPartnerSdkApplicationSkuRecommendationsRouter());
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<JsonResponse> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as JsonResponse["body"],
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

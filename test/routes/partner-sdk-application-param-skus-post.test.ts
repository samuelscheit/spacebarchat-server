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
import type { StoreSkuResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { ApplicationCommandAuthorizationRepository, ApplicationCommandAuthorizationTarget } from "../../src/api/util/utility/ApplicationAuthorization";
import {
    createPartnerSdkApplicationSku,
    createPartnerSdkApplicationSkuUnsupportedError,
    createPartnerSdkApplicationSkusRouter,
    isPartnerSdkApplicationSkusApplicationId,
    PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE,
    type PartnerSdkApplicationSkuCreateProviderOptions,
    type PartnerSdkApplicationSkuCreateProvider,
    type PartnerSdkApplicationSkusDependencies,
} from "../../src/api/routes/partner-sdk/application/#application_id/skus";
import { TeamMemberRole, TeamMemberState } from "../../src/schemas/api/developers/Team";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const applicationId = "100000000000000001";
const coveredManifestId = "api:http:POST:/partner-sdk/application/:application_id/skus/";
const routePath = "/partner-sdk/application/:application_id/skus/";
const openApiPath = "/partner-sdk/application/{application_id}/skus/";
const sourceRoute = "/partner-sdk/application/{application_id}/skus";
const assignedRoute = "/partner-sdk/application/{param}/skus";
const assignedRouteName = "POST_PARTNER_SDK_APPLICATION_APPLICATION_ID_SKUS";

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

type JsonSchema = {
    $ref?: string;
    type?: string;
    maxLength?: number;
    minimum?: number;
};

describe("POST /partner-sdk/application/:application_id/skus", () => {
    test("stays behind bearer authentication and declares the assigned route metadata", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/partner-sdk/application/:application_id/skus/");
        assert.equal(isNoAuthorizationRoute("POST", `/api/v10/partner-sdk/application/${applicationId}/skus`), false);

        const response = await requestJson(createAuthenticatedApp(), `/partner-sdk/application/${applicationId}/skus`, {
            name: "Example Item",
            price_tier: 1,
        });

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "partner-sdk", "application", "#application_id", "skus.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Create Social Layer SKU"/);
        assert.match(routeSource, /requestBody:\s*"PartnerSdkApplicationSkuCreateSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreSkuResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("creates provider-backed Social Layer SKUs for authorized application members", async () => {
        let receivedOptions: PartnerSdkApplicationSkuCreateProviderOptions | undefined;
        const createSkuProvider: PartnerSdkApplicationSkuCreateProvider = (options) => {
            receivedOptions = options;
            return sampleSku;
        };
        const dependencies: PartnerSdkApplicationSkusDependencies = {
            createSkuProvider,
            applicationRepository: applicationRepositoryFor({
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
            }),
        };

        assert.equal(isPartnerSdkApplicationSkusApplicationId(applicationId), true);
        assert.equal(isPartnerSdkApplicationSkusApplicationId("not-a-snowflake"), false);

        const direct = await createPartnerSdkApplicationSku(applicationId, "viewer", { name: "Example Item", price_tier: 1 }, dependencies);
        assert.deepEqual(direct, sampleSku);
        assert.deepEqual(receivedOptions, {
            application_id: applicationId,
            name: "Example Item",
            price_tier: 1,
        });

        const response = await requestJson(createRouteApp(dependencies), `/partner-sdk/application/${applicationId}/skus`, {
            name: "Example Item",
            price_tier: 1,
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleSku);
    });

    test("fails closed for malformed, unknown, unauthorized, or unbacked create attempts", async () => {
        const unsupportedError = createPartnerSdkApplicationSkuUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE);

        await assert.rejects(() => createPartnerSdkApplicationSku("not-a-snowflake", "viewer", { name: "Example Item", price_tier: 1 }), isUnknownApplicationError);
        await assert.rejects(
            () =>
                createPartnerSdkApplicationSku(
                    applicationId,
                    "viewer",
                    { name: "Example Item", price_tier: 1 },
                    {
                        applicationRepository: applicationRepositoryFor(null),
                    },
                ),
            isUnknownApplicationError,
        );
        await assert.rejects(
            () =>
                createPartnerSdkApplicationSku(
                    applicationId,
                    "viewer",
                    { name: "Example Item", price_tier: 1 },
                    {
                        applicationRepository: applicationRepositoryFor({ owner: { id: "owner" }, team: null }),
                        createSkuProvider: () => sampleSku,
                    },
                ),
            isApplicationAuthorizationError,
        );
        await assert.rejects(
            () =>
                createPartnerSdkApplicationSku(
                    applicationId,
                    "viewer",
                    { name: "Example Item", price_tier: 1 },
                    {
                        applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
                    },
                ),
            isUnsupportedError,
        );
        await assert.rejects(
            () =>
                createPartnerSdkApplicationSku(
                    applicationId,
                    "viewer",
                    { name: "Example Item", price_tier: 1 },
                    {
                        applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
                        createSkuProvider: () => ({ ...sampleSku, product_line: 6 }),
                    },
                ),
            isUnsupportedError,
        );

        const malformed = await requestJson(createRouteApp(), "/partner-sdk/application/not-a-snowflake/skus", { name: "Example Item", price_tier: 1 });
        const unauthorized = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor({ owner: { id: "owner" }, team: null }),
                createSkuProvider: () => sampleSku,
            }),
            `/partner-sdk/application/${applicationId}/skus`,
            { name: "Example Item", price_tier: 1 },
        );
        const unsupported = await requestJson(
            createRouteApp({
                applicationRepository: applicationRepositoryFor({ owner: { id: "viewer" }, team: null }),
            }),
            `/partner-sdk/application/${applicationId}/skus`,
            { name: "Example Item", price_tier: 1 },
        );

        assert.equal(malformed.status, 404);
        assert.deepEqual(malformed.body, {
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
            message: PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE,
        });
    });

    test("is present in regenerated schemas, catalogs, manifest, contracts, and OpenAPI", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<
            string,
            {
                type?: string;
                required?: string[];
                properties?: Record<string, JsonSchema>;
            }
        >;
        const openApi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
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
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            request_schema_ref?: string;
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
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.equal(schemas.PartnerSdkApplicationSkuCreateSchema.type, "object");
        assert.deepEqual(schemas.PartnerSdkApplicationSkuCreateSchema.required, ["name", "price_tier"]);
        assert.equal(schemas.PartnerSdkApplicationSkuCreateSchema.properties?.name?.maxLength, 256);
        assert.equal(schemas.PartnerSdkApplicationSkuCreateSchema.properties?.price_tier?.minimum, 0);

        const operation = openApi.paths?.[openApiPath]?.post;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PartnerSdkApplicationSkuCreateSchema");
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StoreSkuResponse");
        for (const status of ["400", "401", "403", "404", "501"]) {
            assert.equal(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        }
        assert.notEqual(openApi.paths?.[openApiPath]?.get, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, routePath);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/partner-sdk/application/#application_id/skus.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "PartnerSdkApplicationSkuCreateSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "StoreSkuResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 403, 404, 501],
        );

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "POST" && entry.route === sourceRoute),
            {
                method: "POST",
                request_schema_ref: "PartnerSdkApplicationSkuCreateSchema",
                response_schema_refs: ["APIErrorResponse", "StoreSkuResponse"],
                route: sourceRoute,
                route_name: assignedRouteName,
                source: "src/api/routes/partner-sdk/application/#application_id/skus.ts",
            },
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedRoute && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, routePath);
        assert.equal(contract?.routeMetadata?.requestBody, "PartnerSdkApplicationSkuCreateSchema");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "StoreSkuResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401, 403, 404, 501],
        );
    });
});

const sampleSku: StoreSkuResponse = {
    id: "300000000000000001",
    type: 3,
    application_id: applicationId,
    product_line: 14,
    flags: 4,
    name: "Example Item",
    slug: "example-item",
    access_type: 1,
    features: [],
    price_tier: 1,
    premium: false,
    show_age_gate: false,
};

function isUnknownApplicationError(error: unknown): boolean {
    return (
        (error as { code?: unknown; message?: unknown })?.code === DiscordApiErrors.UNKNOWN_APPLICATION.code &&
        (error as { message?: unknown })?.message === DiscordApiErrors.UNKNOWN_APPLICATION.message
    );
}

function isApplicationAuthorizationError(error: unknown): boolean {
    return (
        (error as { code?: unknown; message?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code &&
        (error as { message?: unknown })?.message === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message
    );
}

function isUnsupportedError(error: unknown): boolean {
    return (
        (error as { code?: unknown; httpStatus?: unknown; message?: unknown })?.code === 0 &&
        (error as { httpStatus?: unknown })?.httpStatus === 501 &&
        (error as { message?: unknown })?.message === PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE
    );
}

function applicationRepositoryFor(application: ApplicationCommandAuthorizationTarget | null): ApplicationCommandAuthorizationRepository {
    return {
        findOne: async () => application,
    };
}

function createRouteApp(dependencies: PartnerSdkApplicationSkusDependencies = {}) {
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/partner-sdk/application/:application_id/skus", createPartnerSdkApplicationSkusRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/partner-sdk/application/:application_id/skus", createPartnerSdkApplicationSkusRouter());
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string, body: unknown): Promise<JsonResponse> {
    let server: Server | undefined;

    try {
        server = await new Promise<Server>((resolve) => {
            const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        });
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
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

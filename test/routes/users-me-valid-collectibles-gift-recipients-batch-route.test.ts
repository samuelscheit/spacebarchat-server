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
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createCollectiblesGiftRecipientsBatchRouter,
    getValidCollectiblesGiftRecipientsBatch,
    parseCollectiblesGiftRecipientsBatchQuery,
} from "../../src/api/routes/users/@me/valid-collectibles-gift-recipients-batch";
import type { CollectiblesGiftRecipientEligibilityOptions, CollectiblesGiftRecipientEligibilityProvider } from "../../src/api/routes/users/@me/valid-collectibles-gift-recipient";

const coveredManifestIds = ["api:http:GET:/users/@me/valid-collectibles-gift-recipients-batch/"];
const assignedSourcePath = "/users/@me/valid-collectibles-gift-recipients-batch";
const assignedRouteName = "GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENTS_BATCH";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

function assertInvalidFormBody(action: () => unknown) {
    assert.throws(action, (error: unknown) => (error as { code?: number }).code === 50035);
}

function createRouteApp(eligibilityProvider?: CollectiblesGiftRecipientEligibilityProvider) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/valid-collectibles-gift-recipients-batch", createCollectiblesGiftRecipientsBatchRouter(eligibilityProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/users/@me/valid-collectibles-gift-recipients-batch", createCollectiblesGiftRecipientsBatchRouter());
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

describe("GET /users/@me/valid-collectibles-gift-recipients-batch", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/valid-collectibles-gift-recipients-batch/"]);
        assert.equal(assignedSourcePath, "/users/@me/valid-collectibles-gift-recipients-batch");
        assert.equal(assignedRouteName, "GET_USERS__ME_VALID_COLLECTIBLES_GIFT_RECIPIENTS_BATCH");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=2&sku_ids=3"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/users/@me/valid-collectibles-gift-recipients-batch/?recipient_id=2&sku_ids=3"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=2&sku_ids=3");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("validates documented query snowflakes and passes sender context to the eligibility provider", async () => {
        const receivedOptions: CollectiblesGiftRecipientEligibilityOptions[] = [];
        const app = createRouteApp((options) => {
            receivedOptions.push(options);
            return options.sku_id === "300000000000000004";
        });

        assert.deepEqual(
            parseCollectiblesGiftRecipientsBatchQuery({
                recipient_id: "200000000000000002",
                sku_ids: ["300000000000000003,300000000000000004"],
                "sku_ids[]": ["300000000000000003"],
            } as never),
            {
                recipient_id: "200000000000000002",
                sku_ids: ["300000000000000003", "300000000000000004"],
            },
        );

        const response = await requestJson(
            app,
            "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=200000000000000002&sku_ids=300000000000000003&sku_ids[]=300000000000000004",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(receivedOptions, [
            {
                sender_id: "100000000000000001",
                recipient_id: "200000000000000002",
                sku_id: "300000000000000003",
            },
            {
                sender_id: "100000000000000001",
                recipient_id: "200000000000000002",
                sku_id: "300000000000000004",
            },
        ]);
        assert.deepEqual(response.body, {
            "300000000000000003": { valid: false },
            "300000000000000004": { valid: true },
        });
    });

    test("rejects missing, malformed, or over-limit query fields", async () => {
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientsBatchQuery({ sku_ids: "300000000000000003" } as never));
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientsBatchQuery({ recipient_id: "200000000000000002", sku_ids: "not-a-sku" } as never));
        assertInvalidFormBody(() => parseCollectiblesGiftRecipientsBatchQuery({ recipient_id: "0", sku_ids: "300000000000000003" } as never));
        assertInvalidFormBody(() =>
            parseCollectiblesGiftRecipientsBatchQuery({
                recipient_id: "200000000000000002",
                sku_ids: Array.from({ length: 101 }, (_, index) => `300000000000000${String(index).padStart(3, "0")}`),
            } as never),
        );

        const missingSkuIds = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=200000000000000002");
        const malformedSkuId = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=200000000000000002&sku_ids=not-a-sku");
        const shortRecipient = await requestJson(createRouteApp(), "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=2&sku_ids=300000000000000003");

        assert.equal(missingSkuIds.status, 400);
        assert.equal((missingSkuIds.body as { code?: number }).code, 50035);
        assert.equal(malformedSkuId.status, 400);
        assert.equal((malformedSkuId.body as { code?: number }).code, 50035);
        assert.equal(shortRecipient.status, 400);
        assert.equal((shortRecipient.body as { code?: number }).code, 50035);
    });

    test("fails closed when Spacebar has no local collectible gift eligibility backing", async () => {
        let providerCalls = 0;
        const selfGiftResponse = await getValidCollectiblesGiftRecipientsBatch(
            {
                sender_id: "100000000000000001",
                recipient_id: "100000000000000001",
                sku_ids: ["300000000000000003", "300000000000000004"],
            },
            () => {
                providerCalls += 1;
                return true;
            },
        );

        assert.deepEqual(selfGiftResponse, {
            "300000000000000003": { valid: false },
            "300000000000000004": { valid: false },
        });
        assert.equal(providerCalls, 0);

        const response = await requestJson(
            createRouteApp(),
            "/users/@me/valid-collectibles-gift-recipients-batch?recipient_id=200000000000000002&sku_ids=300000000000000003&sku_ids=300000000000000004",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            "300000000000000003": { valid: false },
            "300000000000000004": { valid: false },
        });
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "valid-collectibles-gift-recipients-batch.ts"), "utf8");
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
                    hasQuery?: boolean;
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

        assert.match(routeSource, /summary:\s*"Get Valid Collectibles Gift Recipients Batch"/);
        assert.match(routeSource, /description:\s*"Returns gift eligibility by collectible SKU for a recipient\."/);
        assert.match(routeSource, /recipient_id:\s*\{\s*type:\s*"string",\s*required:\s*true/s);
        assert.match(routeSource, /sku_ids:\s*\{\s*type:\s*"array",\s*required:\s*true/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"CollectiblesGiftRecipientsBatchEligibilityResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.type, "object");
        assert.equal(
            schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.additionalProperties &&
                typeof schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.additionalProperties !== "boolean"
                ? schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.additionalProperties.$ref
                : undefined,
            "#/definitions/CollectiblesGiftRecipientEligibilityResponse",
        );
        assert.equal(
            openapi.components?.schemas?.CollectiblesGiftRecipientsBatchEligibilityResponse?.additionalProperties &&
                typeof openapi.components.schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.additionalProperties !== "boolean"
                ? openapi.components.schemas.CollectiblesGiftRecipientsBatchEligibilityResponse.additionalProperties.$ref
                : undefined,
            "#/components/schemas/CollectiblesGiftRecipientEligibilityResponse",
        );

        const route = openapi.paths?.["/users/@me/valid-collectibles-gift-recipients-batch/"]?.get;
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "recipient_id" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "sku_ids" && parameter.in === "query" && parameter.required === true),
            true,
        );
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CollectiblesGiftRecipientsBatchEligibilityResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/valid-collectibles-gift-recipients-batch/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/valid-collectibles-gift-recipients-batch.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("CollectiblesGiftRecipientsBatchEligibilityResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/valid-collectibles-gift-recipients-batch.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "CollectiblesGiftRecipientsBatchEligibilityResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "CollectiblesGiftRecipientsBatchEligibilityResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400, 401]);
    });
});

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
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";
import contentInventoryApplicationRouter, {
    CONTENT_INVENTORY_APPLICATION_MUTATION_UNSUPPORTED_MESSAGE,
    assertValidContentInventoryApplicationId,
    createContentInventoryApplicationMutationUnsupportedError,
} from "../../src/api/routes/content-inventory/users/@me/applications/#application_id";

const manifestId = "api:http:PATCH:/content-inventory/users/@me/applications/:application_id/";
const sourceFile = "src/api/routes/content-inventory/users/@me/applications/#application_id.ts";
const sourceRoute = "/content-inventory/users/@me/applications/{application_id}";
const openApiPath = "/content-inventory/users/@me/applications/{application_id}/";
const assignedMissingRoute = "/content-inventory/users/@me/applications/{param}";

describe("PATCH /content-inventory/users/@me/applications/:application_id", () => {
    test("declares the assigned manifest id and remains bearer-authenticated", () => {
        assert.equal(manifestId, "api:http:PATCH:/content-inventory/users/@me/applications/:application_id/");
        assert.equal(isNoAuthorizationRoute("PATCH", "/api/v10/content-inventory/users/@me/applications/100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/content-inventory/users/@me/similar-games/100000000000000001"), false);
    });

    test("validates source-backed sharing update bodies without scalar coercion", async () => {
        const validateWithoutCoercion = nonCoercingAjv.getSchema("ContentInventoryApplicationUpdateSchema");
        assert.ok(validateWithoutCoercion, "ContentInventoryApplicationUpdateSchema should be registered");
        assert.deepEqual(validateSchema("ContentInventoryApplicationUpdateSchema", { is_sharing: true }), { is_sharing: true });
        assert.equal(validateWithoutCoercion({ is_sharing: "true" }), false);
        assert.equal(validateWithoutCoercion({}), false);

        const response = await requestJson(createApp(), "/content-inventory/users/@me/applications/100000000000000001", {
            body: { is_sharing: "true" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
    });

    test("rejects malformed application ids before unsupported provider handling", async () => {
        assert.doesNotThrow(() => assertValidContentInventoryApplicationId("100000000000000001"));
        assert.throws(() => assertValidContentInventoryApplicationId("not-a-snowflake"), {
            code: DiscordApiErrors.INVALID_FORM_BODY.code,
        });

        const response = await requestJson(createApp(), "/content-inventory/users/@me/applications/not-a-snowflake", {
            body: { is_sharing: false },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("fails closed because durable per-application sharing state is unsupported", async () => {
        const error = createContentInventoryApplicationMutationUnsupportedError();
        assert.equal(error.httpStatus, 501);
        assert.equal(error.code, 0);
        assert.equal(error.message, CONTENT_INVENTORY_APPLICATION_MUTATION_UNSUPPORTED_MESSAGE);

        const response = await requestJson(createApp(), "/content-inventory/users/@me/applications/100000000000000001", {
            body: { is_sharing: false },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: CONTENT_INVENTORY_APPLICATION_MUTATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents route metadata for the xHyroM compatibility route", () => {
        const routeSource = readFileSync(join(process.cwd(), sourceFile), "utf-8");

        assert.match(routeSource, /summary:\s*"Modify Content Inventory Application"/);
        assert.match(routeSource, /requestBody:\s*"ContentInventoryApplicationUpdateSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /per-user content inventory application sharing state/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("is present in regenerated route artifacts and removed from missing routes", () => {
        const catalog = readJson<
            Array<{
                method: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route: string;
                route_name: string;
                source: string;
            }>
        >(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: Array<{
                method?: string;
                route?: string;
                route_name?: string;
            }>;
        }>(join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: Array<{
                authMode?: string;
                id?: string;
                method?: string;
                path?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }>;
        }>(join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: Array<{
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }>;
        }>(join("test", "generated", "http-contracts.json"));

        const sourceEntry = catalog.find((entry) => entry.method === "PATCH" && entry.route === sourceRoute);
        assert.deepEqual(sourceEntry, {
            method: "PATCH",
            request_schema_ref: "ContentInventoryApplicationUpdateSchema",
            response_schema_refs: ["APIErrorResponse"],
            route: sourceRoute,
            route_name: "PATCH_CONTENT_INVENTORY_USERS__ME_APPLICATIONS_APPLICATION_ID",
            source: sourceFile,
        });

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === assignedMissingRoute),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/content-inventory/users/@me?refresh_token={param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/content-inventory/users/@me/spotify"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/content-inventory/users/@me/outbox/entries/id/{param}/history"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "ContentInventoryApplicationUpdateSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401, 501],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, sourceFile);
        assert.equal(contract?.routeMetadata?.requestBody, "ContentInventoryApplicationUpdateSchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401, 501],
        );
    });

    test("documents bearer security and request schema in OpenAPI", () => {
        const openApi = readJson<{
            components: {
                schemas: Record<string, { properties?: Record<string, { type?: string }>; required?: string[]; type?: string }>;
            };
            paths: Record<
                string,
                {
                    patch?: {
                        requestBody?: {
                            content?: {
                                "application/json"?: {
                                    schema?: {
                                        $ref?: string;
                                    };
                                };
                            };
                        };
                        responses?: Record<
                            string,
                            {
                                content?: {
                                    "application/json"?: {
                                        schema?: {
                                            $ref?: string;
                                        };
                                    };
                                };
                            }
                        >;
                        security?: Array<Record<string, unknown[]>>;
                    };
                }
            >;
        }>(join("assets", "openapi.json"));

        const operation = openApi.paths[openApiPath]?.patch;
        const requestSchema = openApi.components.schemas.ContentInventoryApplicationUpdateSchema;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ContentInventoryApplicationUpdateSchema");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(requestSchema.type, "object");
        assert.deepEqual(requestSchema.required, ["is_sharing"]);
        assert.equal(requestSchema.properties?.is_sharing?.type, "boolean");
    });
});

function createApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/content-inventory/users/@me/applications/:application_id", contentInventoryApplicationRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "PATCH",
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf-8")) as T;
}

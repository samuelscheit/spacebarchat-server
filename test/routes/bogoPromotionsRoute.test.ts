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
import express from "express";
import bogoPromotionsRouter, { listBogoPromotions } from "../../src/api/routes/bogo-promotions";

const coveredManifestIds = ["api:http:GET:/bogo-promotions/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    const?: number;
    enum?: number[];
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /bogo-promotions", () => {
    test("declares the BOGO promotions manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/bogo-promotions/"]);
    });

    test("lists no eligible BOGO promotions until a promotion provider is configured", () => {
        assert.deepEqual(listBogoPromotions(), []);
        assert.notEqual(listBogoPromotions(), listBogoPromotions(), "callers should receive a fresh list");
    });

    test("returns an empty authenticated compatibility list", async () => {
        const response = await requestJson(createRouteApp(), "/bogo-promotions?locale=en-US");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares source-backed metadata and remains bearer-authenticated", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "bogo-promotions.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get BOGO Promotions"/);
        assert.match(routeSource, /description:\s*"Returns BOGO promotions the current user is eligible for\."/);
        assert.match(routeSource, /locale:\s*\{\s*type:\s*"string"/s);
        assert.doesNotMatch(routeSource, /platform:\s*\{/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"BogoPromotionsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/bogo-promotions?locale=en-US"), false);
    });

    test("generates response schema and route artifact metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        };

        assert.equal(schemas.BogoPromotionsResponse.type, "array");
        assert.equal(schemas.BogoPromotionsResponse.items?.$ref, "#/definitions/BogoPromotionResponse");
        assert.equal(schemas.BogoPromotionResponse.properties?.promotion_type?.const, 1);
        assert.deepEqual(schemas.PromotionResponse.required, ["end_date", "id", "promotion_type", "start_date"]);

        const route = openapi.paths?.["/bogo-promotions/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BogoPromotionsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "locale" && parameter.in === "query"),
            true,
        );
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "platform"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/bogo-promotions/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("BogoPromotionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/bogo-promotions", bogoPromotionsRouter);
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
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

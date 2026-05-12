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
import path from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler } from "@spacebar/api";
import express from "express";
import ageVerificationTestRouter, { AGE_VERIFICATION_UNSUPPORTED_MESSAGE } from "../../src/api/routes/age-verification/test";

const coveredManifestIds = ["api:http:POST:/age-verification/test/"];

type JsonSchema = {
    $ref?: string;
};

describe("POST /age-verification/test", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/age-verification/test/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/age-verification/test", ageVerificationTestRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/age-verification/test", { method: "POST" });

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("fails closed without fabricating age-assurance test state", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/age-verification/test", { method: "POST" });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: AGE_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("does not invent request validation for the xHyroM-only route", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/age-verification/test", {
            method: "POST",
            body: {
                verification_vendor_name: "K_ID",
            },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: AGE_VERIFICATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents route metadata and local support limits", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "age-verification", "test.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Test Age Assurance"/);
        assert.match(routeSource, /no age-assurance provider, age-inference model, or durable verified-age-group state/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /requestBody:/);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
    });

    test("generates source catalog, missing-route, OpenAPI, testing manifest, and contract metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            request_schema_ref?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(path.join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: {
                method?: string;
                route?: string;
                route_name?: string;
            }[];
        };
        const xhyromCatalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        };
        const contracts = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/age-verification/test");
        assert.equal(sourceEntry?.route_name, "POST_AGE_VERIFICATION_TEST");
        assert.equal(sourceEntry?.source, "src/api/routes/age-verification/test.ts");
        assert.equal(sourceEntry?.request_schema_ref, undefined);
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "POST" && entry.route === "/age-verification/test");
        assert.equal(xhyromEntry?.route_name, "AGE_ASSURANCE_TEST");
        assert.equal(xhyromEntry?.source, "xhyrom:data/client/routes.json");

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/age-verification/test"),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "OPTIONS" && entry.route === "/age-verification/test"),
            false,
        );

        const route = openapi.paths?.["/age-verification/test/"]?.post;
        assert.equal(route?.summary, "Test Age Assurance");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.requestBody, undefined);
        assert.equal(route?.responses?.["200"], undefined);
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.ok(openapi.components?.schemas?.APIErrorResponse);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/age-verification/test.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/age-verification/test", ageVerificationTestRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

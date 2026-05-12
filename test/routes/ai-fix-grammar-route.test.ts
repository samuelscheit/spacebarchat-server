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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { nonCoercingAjv } from "@spacebar/schemas";
import type { Rights } from "@spacebar/util";
import express from "express";
import aiFixGrammarRouter, { AI_FIX_GRAMMAR_UNSUPPORTED_MESSAGE, createAIFixGrammarUnsupportedError } from "../../src/api/routes/ai/fix-grammar";

const coveredManifestIds = ["api:http:POST:/ai/fix-grammar/"];

type JsonObject = Record<string, unknown>;

describe("POST /ai/fix-grammar", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/ai/fix-grammar/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/ai/fix-grammar", aiFixGrammarRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/ai/fix-grammar", { method: "POST", body: { content: "i can has grammar" } });

        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/ai/fix-grammar"), false);
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("requires local operator rights for the staff-only Discord endpoint", async () => {
        const rightsChecked: string[] = [];
        const app = setupAuthenticatedRoute({ hasOperatorRight: false, rightsChecked });

        const response = await requestJson(app, "/ai/fix-grammar", { method: "POST", body: { content: "i can has grammar" } });

        assert.deepEqual(rightsChecked, ["OPERATOR"]);
        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: 50013,
            message: "You lack rights to perform that action (OPERATOR)",
        });
    });

    test("validates content without scalar coercion before unsupported provider handling", async () => {
        const validate = nonCoercingAjv.getSchema("AIFixGrammarSchema");
        assert.ok(validate);

        assert.equal(validate({ content: "Please fix this sentence." }), true, JSON.stringify(validate.errors));
        assert.equal(validate({ content: "x".repeat(2000) }), true, JSON.stringify(validate.errors));
        assert.equal(validate({ content: "" }), false);
        assert.equal(validate({ content: "x".repeat(2001) }), false);
        assert.equal(validate({ content: 123 }), false);
        assert.equal(validate({ content: "valid", extra: true }), false);
        assert.equal(validate({}), false);

        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/ai/fix-grammar", { method: "POST", body: { content: 123 } });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50035);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.equal(typeof response.body.errors, "object");
    });

    test("fails closed instead of fabricating corrected text without an AI provider", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/ai/fix-grammar", { method: "POST", body: { content: "i can has grammar" } });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: AI_FIX_GRAMMAR_UNSUPPORTED_MESSAGE,
        });
    });

    test("uses an explicit unsupported-provider API error", () => {
        const error = createAIFixGrammarUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, AI_FIX_GRAMMAR_UNSUPPORTED_MESSAGE);
    });

    test("documents route metadata and local support limits", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "ai", "fix-grammar.ts"), "utf8");
        const schemaSource = readFileSync(path.join(process.cwd(), "src", "schemas", "uncategorised", "AIFixGrammarSchema.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Fix Grammar"/);
        assert.match(routeSource, /staff-only AI grammar correction requests/);
        assert.match(routeSource, /fails closed instead of fabricating corrected text/);
        assert.match(routeSource, /requestBody:\s*"AIFixGrammarSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /right:\s*"OPERATOR"/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete)\(/);
        assert.match(schemaSource, /@minLength 1/);
        assert.match(schemaSource, /@maxLength 2000/);
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
        const openapi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                Record<
                    string,
                    {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        "x-right-required"?: string;
                    }
                >
            >;
        };
        const testingManifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                coverage?: { testTier?: string };
                id?: string;
                routeMetadata?: { requestBody?: string; responseBodies?: string[]; responseStatuses?: number[]; right?: string };
                sourceFile?: string;
            }[];
        };
        const contracts = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                routeMetadata?: { requestBody?: string; responses?: string[]; responseStatuses?: number[]; right?: string };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/ai/fix-grammar");
        assert.equal(sourceEntry?.route_name, "POST_AI_FIX_GRAMMAR");
        assert.equal(sourceEntry?.source, "src/api/routes/ai/fix-grammar.ts");
        assert.equal(sourceEntry?.request_schema_ref, "AIFixGrammarSchema");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/ai/fix-grammar"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/ai/title"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/ai/translate"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/ai/summarize-thread/{param}"),
            true,
        );

        const postRoute = openapi.paths?.["/ai/fix-grammar/"]?.post;
        assert.equal(postRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/AIFixGrammarSchema");
        assert.equal(postRoute?.["x-right-required"], "OPERATOR");
        assert.equal(postRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["200"], undefined);

        const manifestEntry = testingManifest.entries?.find((entry) => entry.id === "api:http:POST:/ai/fix-grammar/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/ai/fix-grammar.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "AIFixGrammarSchema");
        assert.equal(manifestEntry?.routeMetadata?.right, "OPERATOR");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [400, 401, 403, 501]);
        assert.equal(manifestEntry?.coverage?.testTier, "contract");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === "api:http:POST:/ai/fix-grammar/");
        assert.equal(contract?.routeMetadata?.requestBody, "AIFixGrammarSchema");
        assert.equal(contract?.routeMetadata?.right, "OPERATOR");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [400, 401, 403, 501]);
    });
});

function setupAuthenticatedRoute(options: { hasOperatorRight?: boolean; rightsChecked?: string[] } = {}) {
    const app = express();
    const hasOperatorRight = options.hasOperatorRight ?? true;
    const rightsChecked = options.rightsChecked;

    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "operator";
        req.rights = {
            has(right: unknown) {
                rightsChecked?.push(String(right));
                return hasOperatorRight;
            },
        } as unknown as Rights;
        next();
    });
    app.use("/ai/fix-grammar", aiFixGrammarRouter);
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
        const text = await response.text();

        return {
            status: response.status,
            body: (text ? JSON.parse(text) : {}) as JsonObject,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

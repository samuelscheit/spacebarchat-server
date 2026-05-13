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
import express from "express";
import applicationsPublicRouter, { APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE, createApplicationsPublicPutUnsupportedError } from "../../src/api/routes/applications/public";

const coveredManifestIds = ["api:http:PUT:/applications/public/"];

type JsonObject = Record<string, unknown>;

describe("PUT /applications/public", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:PUT:/applications/public/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/applications/public", applicationsPublicRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/applications/public", { method: "PUT", body: { application_ids: ["100000000000000001"] } });

        assert.equal(isNoAuthorizationRoute("PUT", "/api/v10/applications/public"), false);
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("fails closed instead of replacing public application records", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/applications/public", { method: "PUT", body: { application_ids: ["100000000000000001"] } });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE,
        });
    });

    test("uses an explicit unsupported-replacement API error", () => {
        const error = createApplicationsPublicPutUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, APPLICATIONS_PUBLIC_PUT_UNSUPPORTED_MESSAGE);
    });

    test("documents route metadata and local support limits", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "applications", "public.ts"), "utf8");

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.match(routeSource, /summary:\s*"Replace Public Applications"/);
        assert.match(routeSource, /PUT \/applications\/public route/);
        assert.match(routeSource, /fails closed instead of fabricating or overwriting public application metadata/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /Application\.find|Application\.save|Application\.update|Application\.delete/);
        assert.doesNotMatch(routeSource, /router\.get\(/);
    });

    test("generates source catalog, missing-route, OpenAPI, testing manifest, and contract metadata", () => {
        const sourceCatalog = JSON.parse(
            readFileSync(path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
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
            paths?: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }> }>>;
        };
        const testingManifest = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                coverage?: { contractChecks?: string[]; testTier?: string };
                id?: string;
                routeMetadata?: { responseBodies?: string[]; responseStatuses?: number[] };
                sourceFile?: string;
            }[];
        };
        const contracts = JSON.parse(readFileSync(path.join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                routeMetadata?: { responses?: string[]; responseStatuses?: number[] };
            }[];
        };

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/applications/public");
        assert.equal(sourceEntry?.route_name, "PUT_APPLICATIONS_PUBLIC");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/public.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/applications/public"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/applications/public"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === "/applications/public"),
            false,
        );

        const putRoute = openapi.paths?.["/applications/public/"]?.put;
        assert.equal(putRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["200"], undefined);

        const manifestEntry = testingManifest.entries?.find((entry) => entry.id === "api:http:PUT:/applications/public/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/applications/public.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);
        assert.equal(manifestEntry?.coverage?.testTier, "stateful-domain");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === "api:http:PUT:/applications/public/");
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
    app.use("/applications/public", applicationsPublicRouter);
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

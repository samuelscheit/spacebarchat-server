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
import Ajv from "ajv";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import applicationDirectoryStaticRouter, {
    APPLICATION_DIRECTORY_CATEGORIES,
    APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL,
    getApplicationDirectoryCategories,
    toApplicationDirectoryCategory,
} from "../../src/api/routes/application-directory-static";

const coveredManifestIds = ["api:http:GET:/application-directory-static/categories"];

function createApp() {
    const app = express();
    app.use(Authentication);
    app.use("/application-directory-static", applicationDirectoryStaticRouter);
    app.use(ErrorHandler);
    return app;
}

async function request(app: express.Express, path: string, init: RequestInit = {}) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`, init);

        return {
            status: response.status,
            headers: response.headers,
            body: init.method === "HEAD" ? undefined : ((await response.json()) as unknown),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /application-directory-static/categories", () => {
    test("documents the assigned manifest id and is public without exposing adjacent paths", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/application-directory-static/categories"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/categories?locale=de"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/application-directory-static/categories/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/categories/extra"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/search"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/application-directory-static/applications/123"), false);

        const response = await request(createApp(), "/application-directory-static/categories?locale=de");

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
        assert.deepEqual(response.body, [
            { id: 6, name: "Spiele" },
            { id: 4, name: "Unterhaltung" },
            { id: 8, name: "Moderation und Tools" },
            { id: 9, name: "Miteinander" },
            { id: 10, name: "N\u00fctzliches" },
        ]);
    });

    test("allows Express HEAD handling for the public GET route", async () => {
        const response = await request(createApp(), "/application-directory-static/categories", { method: "HEAD" });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), APPLICATION_DIRECTORY_STATIC_CACHE_CONTROL);
        assert.equal(response.body, undefined);
    });

    test("returns the source-backed application directory category snapshot in provider order", () => {
        assert.deepEqual(
            APPLICATION_DIRECTORY_CATEGORIES.map(({ id, name }) => ({ id, name })),
            [
                { id: 6, name: "Games" },
                { id: 4, name: "Entertainment" },
                { id: 8, name: "Moderation and Tools" },
                { id: 9, name: "Social" },
                { id: 10, name: "Utilities" },
            ],
        );

        assert.deepEqual(getApplicationDirectoryCategories({}), [
            { id: 6, name: "Games" },
            { id: 4, name: "Entertainment" },
            { id: 8, name: "Moderation and Tools" },
            { id: 9, name: "Social" },
            { id: 10, name: "Utilities" },
        ]);
    });

    test("uses a requested locale when source-backed localization data exists", () => {
        const utilities = APPLICATION_DIRECTORY_CATEGORIES.find((category) => category.id === 10);
        assert.ok(utilities);

        assert.deepEqual(toApplicationDirectoryCategory(utilities, ["de", "fr"]), {
            id: 10,
            name: "N\u00fctzliches",
        });
        assert.deepEqual(toApplicationDirectoryCategory(utilities, "fr"), {
            id: 10,
            name: "Services",
        });
        assert.deepEqual(toApplicationDirectoryCategory(utilities, "unsupported-locale"), {
            id: 10,
            name: "Utilities",
        });
    });

    test("declares public generated metadata and the response schema", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, Record<string, unknown>>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: { schemas?: Record<string, unknown> };
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const catalog = JSON.parse(readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8")) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const ajv = new Ajv({ schemas: Object.entries(schemas).map(([key, schema]) => ({ ...schema, $id: key })) });
        const validate = ajv.compile({ ...schemas.ApplicationDirectoryCategoriesResponse, definitions: schemas });

        assert.equal(
            validate([
                { id: 6, name: "Games" },
                { id: 10, name: "Utilities" },
            ]),
            true,
        );
        assert.equal(validate([{ id: 6, name: "Games", localizations: {} }]), false);
        assert.deepEqual(schemas.ApplicationDirectoryCategoriesResponse, {
            type: "array",
            items: { $ref: "#/definitions/ApplicationDirectoryCategory" },
            $schema: "http://json-schema.org/draft-07/schema#",
        });
        assert.deepEqual(openapi.components?.schemas?.ApplicationDirectoryCategoriesResponse, {
            type: "array",
            items: { $ref: "#/components/schemas/ApplicationDirectoryCategory" },
        });

        const route = openapi.paths?.["/application-directory-static/categories"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDirectoryCategoriesResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/application-directory-static/categories");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/application-directory-static.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationDirectoryCategoriesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), false);

        const catalogEntry = catalog.find((entry) => entry.method === "GET" && entry.route === "/application-directory-static/categories");
        assert.equal(catalogEntry?.route_name, "GET_APPLICATION_DIRECTORY_STATIC_CATEGORIES");
        assert.equal(catalogEntry?.source, "src/api/routes/application-directory-static.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["ApplicationDirectoryCategoriesResponse"]);
    });
});

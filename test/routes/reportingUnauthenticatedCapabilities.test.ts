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
import reportingRouter, { getUnauthenticatedReportCapabilities } from "../../src/api/routes/reporting";

describe("GET /reporting/unauthenticated/capabilities", () => {
    test("returns the conservative local unauthenticated reporting capability set", () => {
        assert.deepEqual(getUnauthenticatedReportCapabilities(), {
            capabilities: [],
        });
    });

    test("is public through the authentication middleware and returns the documented response shape", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/reporting/unauthenticated/capabilities"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/reporting/unauthenticated/capabilities/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/capabilities"), false);

        const response = await requestJson(createRouteApp(), "/reporting/unauthenticated/capabilities");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            capabilities: [],
        });
    });

    test("declares public response metadata in generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<
            string,
            { properties?: Record<string, unknown>; required?: string[] }
        >;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
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
            route?: string;
            route_name?: string;
            response_schema_refs?: string[];
        }[];

        assert.deepEqual(schemas.UnauthenticatedReportCapabilitiesResponse.required, ["capabilities"]);
        assert.deepEqual(schemas.UnauthenticatedReportCapabilitiesResponse.properties?.capabilities, {
            type: "array",
            items: { type: "string" },
        });

        const route = openapi.paths?.["/reporting/unauthenticated/capabilities"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UnauthenticatedReportCapabilitiesResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/reporting/unauthenticated/capabilities");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UnauthenticatedReportCapabilitiesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), false);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/reporting/unauthenticated/capabilities");
        assert.equal(sourceCatalogEntry?.route_name, "GET_REPORTING_UNAUTHENTICATED_CAPABILITIES");
        assert.deepEqual(sourceCatalogEntry?.response_schema_refs, ["UnauthenticatedReportCapabilitiesResponse"]);
    });
});

function createRouteApp() {
    const app = express();
    app.use(Authentication);
    app.use("/reporting", reportingRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson<TBody = unknown>(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as TBody,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

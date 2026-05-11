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
import reportRouter, { listReportReasons, parseReportReasonsQuery } from "../../src/api/routes/report";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /report", () => {
    test("lists no legacy report reasons until a source-backed provider is configured", () => {
        const target = {
            type: "user" as const,
            user_id: "100000000000000001",
        };

        assert.deepEqual(listReportReasons(target), []);
        assert.notEqual(listReportReasons(target), listReportReasons(target), "callers should receive a fresh list");
    });

    test("accepts documented message and user report reason query targets", () => {
        assert.deepEqual(
            parseReportReasonsQuery({
                channel_id: "100000000000000001",
                message_id: "100000000000000002",
            }),
            {
                type: "message",
                channel_id: "100000000000000001",
                message_id: "100000000000000002",
            },
        );
        assert.deepEqual(parseReportReasonsQuery({ user_id: "100000000000000003" }), {
            type: "user",
            user_id: "100000000000000003",
        });
    });

    test("rejects missing, partial, conflicting, and invalid query targets", () => {
        assertReportQueryError({}, "target", "REPORT_TARGET_REQUIRED");
        assertReportQueryError({ channel_id: "100000000000000001" }, "message_id", "MISSING_FIELD");
        assertReportQueryError({ channel_id: "100000000000000001", message_id: "100000000000000002", user_id: "100000000000000003" }, "target", "REPORT_TARGET_CONFLICT");
        assertReportQueryError({ user_id: "not-a-snowflake" }, "user_id", "BASE_TYPE_BAD_LENGTH");
    });

    test("returns the conservative report reasons response shape for authenticated message targets", async () => {
        const response = await requestJson(createRouteApp({ authenticated: true }), "/report?channel_id=100000000000000001&message_id=100000000000000002");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("returns field errors for invalid report reason query targets", async () => {
        const response = await requestJson(createRouteApp({ authenticated: true }), "/report?user_id=invalid");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: number }).code, 50035);
        assert.equal((response.body as { message?: string }).message, "Invalid Form Body");
        assert.equal((response.body as { errors?: Record<string, { _errors?: { code?: string }[] }> }).errors?.user_id?._errors?.[0]?.code, "BASE_TYPE_BAD_LENGTH");
    });

    test("is bearer-authenticated through the authentication middleware", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/report?user_id=100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/report/?user_id=100000000000000001"), false);

        const response = await requestJson(createRouteApp({ authenticationMiddleware: true }), "/report?user_id=100000000000000001");

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
            code: 401,
            message: "Error: Missing Authorization Header",
        });
    });

    test("declares source-backed route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "report", "index.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Report Reasons"/);
        assert.match(routeSource, /description:\s*"Returns legacy report reason objects that can be used when creating a report for a message or user\."/);
        assert.match(routeSource, /query:\s*\{[\s\S]*channel_id[\s\S]*message_id[\s\S]*user_id/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ReportReasonsResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates response schema and route artifact metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: { type?: string } }[];
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
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            response_schema_refs?: string[];
        }[];

        assert.equal(schemas.ReportReasonsResponse.type, "array");
        assert.equal(schemas.ReportReasonsResponse.items?.$ref, "#/definitions/ReportReasonResponse");
        assert.deepEqual(schemas.ReportReasonResponse.required, ["description", "label", "reason"]);
        assert.equal(schemas.ReportReasonResponse.properties?.reason?.type, "integer");

        const route = openapi.paths?.["/report/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ReportReasonsResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(
            route?.parameters?.map((parameter) => [parameter.name, parameter.in, parameter.required, parameter.schema?.type]),
            [
                ["channel_id", "query", false, "string"],
                ["message_id", "query", false, "string"],
                ["user_id", "query", false, "string"],
            ],
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/report/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ReportReasonsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/report");
        assert.equal(sourceCatalogEntry?.route_name, "GET_REPORT");
        assert.deepEqual(sourceCatalogEntry?.response_schema_refs, ["APIErrorResponse", "ReportReasonsResponse"]);
    });
});

function assertReportQueryError(query: Parameters<typeof parseReportReasonsQuery>[0], field: string, code: string) {
    assert.throws(
        () => parseReportReasonsQuery(query),
        (error) => (error as { errors?: Record<string, { _errors?: { code?: string }[] }> }).errors?.[field]?._errors?.[0]?.code === code,
    );
}

function createRouteApp(options: { authenticated?: boolean; authenticationMiddleware?: boolean }) {
    const app = express();

    if (options.authenticationMiddleware) app.use(Authentication);
    if (options.authenticated) {
        app.use((req, _res, next) => {
            req.user_id = "viewer";
            next();
        });
    }
    app.use("/report", reportRouter);
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

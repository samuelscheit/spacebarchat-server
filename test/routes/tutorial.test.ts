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
import { ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import tutorialRouter, { getCurrentUserTutorial } from "../../src/api/routes/tutorial";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";

const coveredManifestIds = ["api:http:GET:/tutorial/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

describe("GET /tutorial", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/tutorial/"]);
    });

    test("is bearer-authenticated and not an adjacent tutorial indicator route", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/tutorial"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/tutorial"), false);
        assert.equal(isNoAuthorizationRoute("PUT", "/tutorial/indicators/example"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/tutorial/indicators/suppress"), false);
    });

    test("returns 204 with no body when Spacebar has no persisted tutorial state", async () => {
        const app = createRouteApp();

        assert.equal(await getCurrentUserTutorial("100000000000000001"), null);

        const response = await requestText(app, "/tutorial");

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "tutorial.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
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
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };

        assert.match(routeSource, /summary:\s*"Get Tutorial"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"TutorialResponse"/s);
        assert.match(routeSource, /204:\s*\{\s*\}/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.deepEqual(schemas.TutorialResponse.required, ["indicators_confirmed", "indicators_suppressed"]);
        assert.equal(schemas.TutorialResponse.properties?.indicators_suppressed?.type, "boolean");
        assert.equal(schemas.TutorialResponse.properties?.indicators_confirmed?.type, "array");
        assert.equal(schemas.TutorialResponse.properties?.indicators_confirmed?.items?.type, "string");

        const route = openapi.paths?.["/tutorial/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/TutorialResponse");
        assert.ok(route?.responses?.["204"], "204 response should be documented for missing local tutorial state");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("TutorialResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(204), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/tutorial");
        assert.equal(catalogEntry?.route_name, "GET_TUTORIAL");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "TutorialResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/tutorial"),
            false,
        );
    });

    test("validates the documented tutorial response schema", () => {
        const payload = {
            indicators_suppressed: false,
            indicators_confirmed: ["create_first_server", "invite_friend"],
        };
        const validateWithoutCoercion = nonCoercingAjv.getSchema("TutorialResponse");

        assert.deepEqual(validateSchema("TutorialResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "TutorialResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion({ indicators_suppressed: false }), false);
        assert.match(JSON.stringify(validateWithoutCoercion.errors), /indicators_confirmed/);
        assert.equal(validateWithoutCoercion({ indicators_suppressed: false, indicators_confirmed: [1] }), false);
        assert.match(JSON.stringify(validateWithoutCoercion.errors), /type/);
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/tutorial", tutorialRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestText(app: express.Express, path: string) {
    const server = await listen(app);
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express): Promise<Server> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    return server;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import {
    assertValidStoreEulaId,
    createStoreEulasRouter,
    findStoreEula,
    getStoreEula,
    toStoreEulaResponse,
    UNKNOWN_EULA_ERROR,
    type StoreEulaSource,
} from "../../src/api/routes/store/eulas/#eula_id";
import { ConfigValue, StoreConfiguration, StoreEulaConfiguration } from "../../src/util";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/store/eulas/:eula_id/"];

const sampleEula = {
    id: "100000000000000001",
    name: "Example Game EULA",
    content: "Terms supplied by the application owner.",
};

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("GET /store/eulas/:eula_id", () => {
    test("documents exact path ownership and stays public through authentication middleware", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/store/eulas/:eula_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/store/eulas/100000000000000001"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/store/eulas/100000000000000001/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/store/eulas/100000000000000001"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/store/eulas/100000000000000001/extra"), false);

        const response = await requestJson(
            createAuthenticatedApp(() => sampleEula),
            `/store/eulas/${sampleEula.id}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleEula);
    });

    test("returns only configured source-backed EULA fields", async () => {
        const configuredEula = new StoreEulaConfiguration();
        configuredEula.id = sampleEula.id;
        configuredEula.name = sampleEula.name;
        configuredEula.content = sampleEula.content;
        const eulaWithExtraData = { ...configuredEula, internal_notes: "do not serialize" } as StoreEulaSource & { internal_notes: string };

        assert.deepEqual(toStoreEulaResponse(eulaWithExtraData), sampleEula);
        assert.deepEqual(findStoreEula(sampleEula.id, [{ id: "100000000000000002", name: "Other", content: "Other terms" }, eulaWithExtraData]), sampleEula);
        assert.deepEqual(
            getStoreEula(sampleEula.id, (eulaId) => (eulaId === sampleEula.id ? eulaWithExtraData : undefined)),
            sampleEula,
        );

        const response = await requestJson(
            createRouteApp(() => eulaWithExtraData),
            `/store/eulas/${sampleEula.id}`,
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, sampleEula);
        assert.equal((response.body as { internal_notes?: unknown }).internal_notes, undefined);
    });

    test("returns Unknown EULA instead of fabricating legal content", async () => {
        let providerCalled = false;

        assert.throws(() => assertValidStoreEulaId("not-a-snowflake"), isUnknownEulaError);
        assert.throws(
            () =>
                getStoreEula("not-a-snowflake", () => {
                    providerCalled = true;
                    return sampleEula;
                }),
            isUnknownEulaError,
        );
        assert.equal(providerCalled, false);
        assert.throws(() => getStoreEula(sampleEula.id, () => undefined), isUnknownEulaError);

        const missingResponse = await requestJson(
            createRouteApp(() => undefined),
            `/store/eulas/${sampleEula.id}`,
        );
        const invalidResponse = await requestJson(
            createRouteApp(() => sampleEula),
            "/store/eulas/not-a-snowflake",
        );

        assert.equal(missingResponse.status, 404);
        assert.deepEqual(missingResponse.body, { code: 10044, message: "Unknown EULA" });
        assert.equal(invalidResponse.status, 404);
        assert.deepEqual(invalidResponse.body, { code: 10044, message: "Unknown EULA" });
    });

    test("exposes configured EULA storage without default content", () => {
        const config = new ConfigValue();

        assert.ok(config.store instanceof StoreConfiguration);
        assert.deepEqual(config.store.customEulas, []);
    });

    test("declares public source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "store", "eulas", "#eula_id.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
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

        assert.match(routeSource, /summary:\s*"Get EULA"/);
        assert.match(routeSource, /description:\s*"Returns the EULA object for the given EULA ID\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"StoreEulaResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.StoreEulaResponse.type, "object");
        for (const field of ["id", "name", "content"]) {
            assert.equal(schemas.StoreEulaResponse.required?.includes(field), true);
            assert.equal(schemas.StoreEulaResponse.properties?.[field]?.type, "string");
        }
        assert.equal(schemas.StoreConfiguration.properties?.customEulas?.type, "array");
        assert.equal(schemas.StoreConfiguration.properties?.customEulas?.items?.$ref, "#/definitions/StoreEulaConfiguration");

        const route = openapi.paths?.["/store/eulas/{eula_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/StoreEulaResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("StoreEulaResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(404), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), false);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/store/eulas/{eula_id}");
        assert.equal(catalogEntry?.route_name, "GET_STORE_EULAS_EULA_ID");
        assert.equal(catalogEntry?.source, "src/api/routes/store/eulas/#eula_id.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "StoreEulaResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/store/eulas/{param}" && entry.route_name === "GET_STORE_EULAS_EULA_ID"),
            false,
        );
    });
});

function isUnknownEulaError(error: unknown): boolean {
    return (
        (error as { code?: unknown; message?: unknown })?.code === UNKNOWN_EULA_ERROR.code &&
        (error as { code?: unknown; message?: unknown })?.message === UNKNOWN_EULA_ERROR.message
    );
}

function createRouteApp(eulaProvider: (eulaId: string) => StoreEulaSource | undefined) {
    const app = express();

    app.use("/store/eulas/:eula_id", createStoreEulasRouter(eulaProvider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp(eulaProvider: (eulaId: string) => StoreEulaSource | undefined) {
    const app = express();

    app.use(Authentication);
    app.use("/store/eulas/:eula_id", createStoreEulasRouter(eulaProvider));
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

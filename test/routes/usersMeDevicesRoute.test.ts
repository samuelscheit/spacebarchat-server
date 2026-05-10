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
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import type { PushNotificationDeviceUnregisterSchema } from "@spacebar/schemas";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import devicesRouter, { unregisterPushNotificationDevice } from "../../src/api/routes/users/@me/devices";
import {
    createDeviceSyncTokenPayload,
    createDeviceSyncTokenRouter,
    DEVICE_SYNC_TOKEN_TTL_SECONDS,
    type DeviceSyncTokenDependencies,
} from "../../src/api/routes/users/@me/devices/sync-token";

interface OpenApiOperation {
    security?: { bearer?: unknown[] }[];
    requestBody?: {
        required?: boolean;
        content?: {
            "application/json"?: {
                schema?: { $ref?: string };
            };
        };
    };
    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
}

interface JsonSchema {
    type?: string;
    enum?: unknown[];
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, { $ref?: string; type?: string; minLength?: number }>;
}

interface RouteCatalogEntry {
    method: string;
    route: string;
    route_name: string;
    source: string;
    response_schema_refs?: string[];
}

interface MissingRouteEntry {
    method: string;
    route: string;
    route_name: string;
}

describe("DELETE /users/@me/devices", () => {
    test("acknowledges a documented push-device unregister payload without durable storage", async () => {
        const payload: PushNotificationDeviceUnregisterSchema = {
            provider: "gcm",
            token: "push-token",
        };

        await assert.doesNotReject(() => unregisterPushNotificationDevice("user-id", payload));

        const response = await requestRoute(createDevicesRouteApp(), "/users/@me/devices", {
            method: "DELETE",
            body: payload,
        });

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
    });

    test("validates required provider and token fields before acknowledging unregister", async () => {
        const response = await requestRoute(createDevicesRouteApp(), "/users/@me/devices", {
            method: "DELETE",
            body: {
                provider: "gcm",
            },
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
    });

    test("keeps the route authenticated", () => {
        assert.equal(isNoAuthorizationRoute("DELETE", "/users/@me/devices"), false);
        assert.equal(isNoAuthorizationRoute("DELETE", "/api/v9/users/@me/devices"), false);
    });

    test("documents bearer auth, request schema, and empty response in generated OpenAPI", () => {
        const operation = getDevicesOpenApiDeleteOperation();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.equal(operation.requestBody?.required, true);
        assert.deepEqual(operation.requestBody?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/PushNotificationDeviceUnregisterSchema",
        });
        assert.equal("content" in (operation.responses?.["204"] ?? {}), false);
        assert.deepEqual(operation.responses?.["400"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
        assert.deepEqual(operation.responses?.["401"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });

    test("generates the documented unregister request schema", () => {
        const schemas = readSchemas();
        const unregisterSchema = schemas.PushNotificationDeviceUnregisterSchema;
        const providerSchema = resolveSchemaRef(schemas, unregisterSchema.properties?.provider);

        assert.deepEqual(unregisterSchema.required?.sort(), ["provider", "token"]);
        assert.equal(unregisterSchema.additionalProperties, false);
        assert.deepEqual(providerSchema.enum?.sort(), ["apns", "apns_internal", "apns_internal_voip", "apns_voip", "gcm"]);
        assert.equal(unregisterSchema.properties?.token?.type, "string");
        assert.equal(unregisterSchema.properties?.token?.minLength, 1);
    });
});

describe("GET /users/@me/devices/sync-token", () => {
    test("creates scoped expiring device-sync token payloads with the current session id", () => {
        assert.deepEqual(createDeviceSyncTokenPayload("user-id", "key-id", 1700000000, "session-id"), {
            sub: "user-id",
            iat: 1700000000,
            exp: 1700000000 + DEVICE_SYNC_TOKEN_TTL_SECONDS,
            kid: "key-id",
            typ: "push_sync",
            ver: 1,
            did: "session-id",
        });
    });

    test("omits the session id when the bearer token has no hydrated session", () => {
        assert.deepEqual(createDeviceSyncTokenPayload("user-id", "key-id", 1700000000), {
            sub: "user-id",
            iat: 1700000000,
            exp: 1700000000 + DEVICE_SYNC_TOKEN_TTL_SECONDS,
            kid: "key-id",
            typ: "push_sync",
            ver: 1,
        });
    });

    test("returns a documented token response for the authenticated user", async () => {
        const calls: Array<{ userId: string; sessionId: string | undefined; nowSeconds: number }> = [];
        const deps: DeviceSyncTokenDependencies = {
            nowSeconds: () => 1700000000,
            issueDeviceSyncToken: async (userId, sessionId, nowSeconds) => {
                calls.push({ userId, sessionId, nowSeconds });
                return "signed-device-sync-token";
            },
        };

        const response = await requestRoute(createDeviceSyncTokenRouteApp(deps), "/users/@me/devices/sync-token", {
            method: "GET",
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { token: "signed-device-sync-token" });
        assert.deepEqual(calls, [{ userId: "user-id", sessionId: "session-id", nowSeconds: 1700000000 }]);
    });

    test("keeps the route authenticated", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/devices/sync-token"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/devices/sync-token"), false);
    });

    test("documents bearer auth and response schemas in generated OpenAPI", () => {
        const operation = getDeviceSyncTokenOpenApiGetOperation();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.deepEqual(operation.responses?.["200"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/DeviceSyncTokenResponse",
        });
        assert.deepEqual(operation.responses?.["401"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });

    test("generates the documented response schema", () => {
        const schemas = readSchemas();
        const responseSchema = schemas.DeviceSyncTokenResponse;

        assert.deepEqual(responseSchema.required, ["token"]);
        assert.equal(responseSchema.additionalProperties, false);
        assert.equal(responseSchema.properties?.token?.type, "string");
    });

    test("regenerates source and missing-route catalogs for the assigned path", () => {
        const sourceCatalog = readJson<RouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const sourceEntries = sourceCatalog.filter((entry) => entry.route === "/users/@me/devices/sync-token");
        assert.deepEqual(sourceEntries, [
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "DeviceSyncTokenResponse"],
                route: "/users/@me/devices/sync-token",
                route_name: "GET_USERS__ME_DEVICES_SYNC_TOKEN",
                source: "src/api/routes/users/@me/devices/sync-token.ts",
            },
        ]);

        const missing = readJson<{ missing_entries: MissingRouteEntry[] }>("packages/missing-routes/missing.json");
        assert.equal(
            missing.missing_entries.some((entry) => entry.route === "/users/@me/devices/sync-token"),
            false,
        );
    });
});

function createDevicesRouteApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        (req as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/users/@me/devices", devicesRouter);
    app.use(ErrorHandler);

    return app;
}

function createDeviceSyncTokenRouteApp(deps: DeviceSyncTokenDependencies): express.Express {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        req.session = { session_id: "session-id" } as express.Request["session"];
        (req as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/users/@me/devices/sync-token", createDeviceSyncTokenRouter(deps));
    app.use(ErrorHandler);

    return app;
}

async function requestRoute(app: express.Express, path: string, options: { method: string; body?: unknown }): Promise<{ status: number; text: string; body?: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });
        const text = await response.text();

        return {
            status: response.status,
            text,
            body: text ? JSON.parse(text) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function getDevicesOpenApiDeleteOperation(): OpenApiOperation {
    const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
        paths: Record<string, { delete?: OpenApiOperation }>;
    };

    const routePath = openapi.paths["/users/@me/devices/"] ?? openapi.paths["/users/@me/devices"];
    assert.ok(routePath?.delete, "OpenAPI should include DELETE /users/@me/devices");

    return routePath.delete;
}

function getDeviceSyncTokenOpenApiGetOperation(): OpenApiOperation {
    const openapi = readJson<{
        paths: Record<string, { get?: OpenApiOperation }>;
    }>(join("assets", "openapi.json"));

    const routePath = openapi.paths["/users/@me/devices/sync-token/"] ?? openapi.paths["/users/@me/devices/sync-token"];
    assert.ok(routePath?.get, "OpenAPI should include GET /users/@me/devices/sync-token");

    return routePath.get;
}

function readSchemas(): Record<string, JsonSchema> {
    return readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
}

function resolveSchemaRef(schemas: Record<string, JsonSchema>, schema: { $ref?: string } | undefined): JsonSchema {
    const schemaName = schema?.$ref?.replace("#/definitions/", "");
    assert.ok(schemaName, "schema reference should be present");
    const resolved = schemas[schemaName];
    assert.ok(resolved, `schema ${schemaName} should resolve`);

    return resolved;
}

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

function readSchemas(): Record<string, JsonSchema> {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
}

function resolveSchemaRef(schemas: Record<string, JsonSchema>, schema: { $ref?: string } | undefined): JsonSchema {
    const schemaName = schema?.$ref?.replace("#/definitions/", "");
    assert.ok(schemaName, "schema reference should be present");
    const resolved = schemas[schemaName];
    assert.ok(resolved, `schema ${schemaName} should resolve`);

    return resolved;
}

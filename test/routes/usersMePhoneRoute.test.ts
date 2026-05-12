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
import type { UserPhoneRemoveSchema } from "@spacebar/schemas";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import {
    createCurrentUserPhoneRouter,
    removeCurrentUserPhone,
    type CurrentUserPhoneRemovalRecord,
    type RemoveCurrentUserPhoneDependencies,
} from "../../src/api/routes/users/@me/phone";

interface OpenApiOperation {
    security?: { bearer?: unknown[] }[];
    "x-fires-event"?: string | string[];
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
    properties?: Record<string, { $ref?: string; type?: string; minLength?: number; maxLength?: number }>;
}

interface RouteCatalogEntry {
    method: string;
    route: string;
    route_name: string;
    source: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
}

interface MissingRouteEntry {
    method: string;
    route: string;
    route_name: string;
}

const validBody: UserPhoneRemoveSchema = {
    password: "correct-password",
    change_phone_reason: "user_settings_update",
};

describe("DELETE /users/@me/phone", () => {
    test("removes only the current user's phone after password verification and emits a user update", async () => {
        const user = new FakePhoneUser({ hash: "stored-hash", phone: "+15555550123" });
        const calls: unknown[] = [];
        const emitted: unknown[] = [];
        const deps = createDeps(user, {
            comparePassword: async (password, hash) => {
                calls.push({ password, hash });
                return true;
            },
            emitUserUpdate: async (userId, updatedUser) => {
                emitted.push({ userId, updatedUser });
            },
        });

        await removeCurrentUserPhone("user-id", validBody, { invalidPasswordMessage: "invalid password" }, deps);

        assert.deepEqual(calls, [{ password: "correct-password", hash: "stored-hash" }]);
        assert.equal(user.phone, null);
        assert.deepEqual(user.assigned, [{ phone: null }]);
        assert.equal(user.saveCount, 1);
        assert.equal("data" in user, false);
        assert.deepEqual(emitted, [{ userId: "user-id", updatedUser: user }]);
    });

    test("rejects an invalid current password before mutating account state", async () => {
        const user = new FakePhoneUser({ hash: "stored-hash", phone: "+15555550123" });
        const emitted: unknown[] = [];
        const deps = createDeps(user, {
            comparePassword: async () => false,
            emitUserUpdate: async (userId, updatedUser) => {
                emitted.push({ userId, updatedUser });
            },
        });

        await assert.rejects(() => removeCurrentUserPhone("user-id", validBody, { invalidPasswordMessage: "invalid password" }, deps), {
            code: 50035,
        });

        assert.equal(user.phone, "+15555550123");
        assert.deepEqual(user.assigned, []);
        assert.equal(user.saveCount, 0);
        assert.deepEqual(emitted, []);
        assert.equal(user.data.hash, "stored-hash");
    });

    test("sets a password for passwordless accounts before removing the phone number", async () => {
        const user = new FakePhoneUser({ phone: "+15555550123" });
        const deps = createDeps(user, {
            hashPassword: async (password) => `hashed:${password}`,
        });

        await removeCurrentUserPhone("user-id", validBody, { invalidPasswordMessage: "invalid password" }, deps);

        assert.deepEqual(user.savedHashes, ["hashed:correct-password"]);
        assert.equal(user.phone, null);
        assert.equal("data" in user, false);
    });

    test("validates the documented password and change reason body", async () => {
        const user = new FakePhoneUser({ hash: "stored-hash", phone: "+15555550123" });
        const deps = createDeps(user);
        const response = await requestRoute(createPhoneRouteApp(deps), "/users/@me/phone", {
            method: "DELETE",
            body: {
                password: "correct-password",
                change_phone_reason: "not_documented",
            },
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
        assert.equal(user.saveCount, 0);
    });

    test("returns 204 for a valid authenticated phone removal request", async () => {
        const user = new FakePhoneUser({ hash: "stored-hash", phone: "+15555550123" });
        const response = await requestRoute(createPhoneRouteApp(createDeps(user)), "/users/@me/phone", {
            method: "DELETE",
            body: validBody,
        });

        assert.equal(response.status, 204);
        assert.equal(response.text, "");
        assert.equal(user.phone, null);
        assert.equal(user.saveCount, 1);
    });

    test("keeps the route authenticated", () => {
        assert.equal(isNoAuthorizationRoute("DELETE", "/users/@me/phone"), false);
        assert.equal(isNoAuthorizationRoute("DELETE", "/api/v9/users/@me/phone"), false);
    });

    test("documents bearer auth, update event, request schema, and empty response in generated OpenAPI", () => {
        const operation = getPhoneOpenApiDeleteOperation();

        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.equal(operation["x-fires-event"], "USER_UPDATE");
        assert.equal(operation.requestBody?.required, true);
        assert.deepEqual(operation.requestBody?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/UserPhoneRemoveSchema",
        });
        assert.equal("content" in (operation.responses?.["204"] ?? {}), false);
        assert.deepEqual(operation.responses?.["400"]?.content?.["application/json"]?.schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });

    test("generates the documented phone removal schema", () => {
        const schemas = readSchemas();
        const removeSchema = schemas.UserPhoneRemoveSchema;
        const reasonSchema = resolveSchemaRef(schemas, removeSchema.properties?.change_phone_reason);

        assert.deepEqual(removeSchema.required?.sort(), ["change_phone_reason", "password"]);
        assert.equal(removeSchema.additionalProperties, false);
        assert.deepEqual(reasonSchema.enum?.sort(), ["contact_sync", "guild_phone_required", "mfa_phone_update", "user_action_required", "user_settings_update"]);
        assert.equal(removeSchema.properties?.password?.type, "string");
        assert.equal(removeSchema.properties?.password?.minLength, 1);
        assert.equal(removeSchema.properties?.password?.maxLength, 72);
    });

    test("regenerates source and missing-route catalogs for only the assigned DELETE method", () => {
        const sourceCatalog = readJson<RouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const sourceEntries = sourceCatalog.filter((entry) => entry.route === "/users/@me/phone");

        assert.deepEqual(sourceEntries, [
            {
                method: "DELETE",
                request_schema_ref: "UserPhoneRemoveSchema",
                response_schema_refs: ["APIErrorResponse"],
                route: "/users/@me/phone",
                route_name: "DELETE_USERS__ME_PHONE",
                source: "src/api/routes/users/@me/phone.ts",
            },
        ]);

        const missing = readJson<{ missing_entries: MissingRouteEntry[] }>("packages/missing-routes/missing.json");
        assert.equal(
            missing.missing_entries.some((entry) => entry.route_name === "DELETE_USERS__ME_PHONE"),
            false,
        );
        assert.equal(
            missing.missing_entries.some((entry) => entry.route_name === "POST_USERS__ME_PHONE"),
            true,
        );
    });
});

class FakePhoneUser {
    id = "user-id";
    username = "user";
    phone?: string | null;
    data: { hash?: string } = {};
    assigned: unknown[] = [];
    saveCount = 0;
    savedHashes: Array<string | undefined> = [];

    constructor(options: { hash?: string; phone?: string }) {
        this.data.hash = options.hash;
        this.phone = options.phone;
    }

    assign(props: Record<string, unknown>) {
        this.assigned.push(props);
        Object.assign(this, props);
        return this;
    }

    async save() {
        this.saveCount += 1;
        this.savedHashes.push(this.data.hash);
    }

    toPublicUser() {
        return {
            id: this.id,
            username: this.username,
        };
    }
}

function createDeps(user: FakePhoneUser, overrides: Partial<RemoveCurrentUserPhoneDependencies> = {}): RemoveCurrentUserPhoneDependencies {
    return {
        findUser: async (userId) => {
            assert.equal(userId, "user-id");
            return user as unknown as CurrentUserPhoneRemovalRecord;
        },
        comparePassword: async () => true,
        hashPassword: async (password) => `hashed:${password}`,
        emitUserUpdate: async () => undefined,
        ...overrides,
    };
}

function createPhoneRouteApp(deps: RemoveCurrentUserPhoneDependencies): express.Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        (req as unknown as { t: (key: string) => string }).t = (key: string) => key;
        next();
    });
    app.use("/users/@me/phone", createCurrentUserPhoneRouter(deps));
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

function getPhoneOpenApiDeleteOperation(): OpenApiOperation {
    const openapi = readJson<{
        paths: Record<string, { delete?: OpenApiOperation }>;
    }>(join("assets", "openapi.json"));

    const routePath = openapi.paths["/users/@me/phone/"] ?? openapi.paths["/users/@me/phone"];
    assert.ok(routePath?.delete, "OpenAPI should include DELETE /users/@me/phone");

    return routePath.delete;
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

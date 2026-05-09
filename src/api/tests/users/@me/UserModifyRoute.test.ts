import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Router } from "express";
import { createUserRouteApp, mockCurrentUserLookup, requestJson } from "../../helpers/UserRouteTestHelpers";

describe("PATCH /users/@me", () => {
    test("accepts profile updates without discriminator and skips discriminator uniqueness lookup", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const { User } = require("@spacebar/util") as typeof import("@spacebar/util");
        const routeModulePath = require.resolve("@spacebar/api/routes/users/@me/index");
        delete require.cache[routeModulePath];

        const getAssignedBody = mockCurrentUserLookup(t, User);
        let discriminatorLookupCount = 0;
        t.mock.method(User, "findOne", async () => {
            discriminatorLookupCount += 1;
            return null;
        });

        try {
            const router = require(routeModulePath).default as Router;
            const app = createUserRouteApp(router);
            const response = await requestJson(app, "/users/@me", {
                method: "PATCH",
                body: {
                    bio: "Updated profile",
                },
            });

            assert.equal(response.status, 200);
            assert.deepEqual(getAssignedBody(), {
                bio: "Updated profile",
            });
            assert.equal(discriminatorLookupCount, 0);
        } finally {
            delete require.cache[routeModulePath];
        }
    });

    test("checks discriminator uniqueness when discriminator is provided", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const { User } = require("@spacebar/util") as typeof import("@spacebar/util");
        const routeModulePath = require.resolve("@spacebar/api/routes/users/@me/index");
        delete require.cache[routeModulePath];

        const getAssignedBody = mockCurrentUserLookup(t, User);
        let discriminatorLookupOptions: unknown;
        t.mock.method(User, "findOne", async (options: unknown) => {
            discriminatorLookupOptions = options;
            return null;
        });

        try {
            const router = require(routeModulePath).default as Router;
            const app = createUserRouteApp(router);
            const response = await requestJson(app, "/users/@me", {
                method: "PATCH",
                body: {
                    bio: "Updated profile",
                    discriminator: "1234",
                },
            });

            assert.equal(response.status, 200);
            assert.deepEqual(getAssignedBody(), {
                bio: "Updated profile",
                discriminator: "1234",
            });
            const where = (discriminatorLookupOptions as { where: Record<string, unknown> }).where;
            const idOperator = where.id as { _multipleParameters?: boolean; _type?: string; _useParameter?: boolean; _value?: unknown };
            assert.equal(where.discriminator, "1234");
            assert.equal(where.username, "user");
            assert.equal(idOperator._type, "not");
            assert.equal(idOperator._value, "user-id");
            assert.equal(idOperator._useParameter, true);
            assert.equal(idOperator._multipleParameters, false);
        } finally {
            delete require.cache[routeModulePath];
        }
    });
});

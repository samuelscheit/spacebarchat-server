import assert from "node:assert/strict";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";
import { EntityNotFoundError } from "typeorm";

const requireModule = require;
const routeModulePath = require.resolve("./rules");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/auto-moderation/rules/:rule_id", () => {
    test("returns the scoped auto moderation rule for the requested guild and rule ids", async (t) => {
        const harness = setupAutomodRulesRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-a/auto-moderation/rules/rule-a");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "rule-a",
            guild_id: "guild-a",
            creator_id: "owner-a",
            name: "keyword block",
            event_type: 1,
            trigger_type: 1,
            trigger_metadata: {
                keyword_filter: ["blocked"],
                regex_patterns: [],
                allow_list: [],
            },
            actions: [{ type: 1 }],
            enabled: true,
            exempt_channels: [],
            exempt_roles: [],
            position: 0,
        });
        assert.deepEqual(harness.findOneOrFailOptions, [{ where: { guild_id: "guild-a", id: "rule-a" } }]);
    });

    test("uses MANAGE_GUILD metadata and declares single-rule success and error responses", (t) => {
        const harness = setupAutomodRulesRoute(t);

        assert.deepEqual(harness.singleRuleGetRouteOptions, {
            permission: ["MANAGE_GUILD"],
            responses: {
                200: {
                    body: "AutomodRuleResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns the existing API 404 for absent or cross-guild rule ids", async (t) => {
        const harness = setupAutomodRulesRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-b/auto-moderation/rules/rule-a");

        assert.equal(response.status, 404);
        assert.equal(response.body.code, 404);
        assert.equal(response.body.message, "AutomodRule could not be found");
        assert.deepEqual(harness.findOneOrFailOptions, [{ where: { guild_id: "guild-b", id: "rule-a" } }]);
    });
});

function setupAutomodRulesRoute(t: TestContext) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const findOneOrFailOptions: unknown[] = [];
    const rule = {
        id: "rule-a",
        guild_id: "guild-a",
        creator_id: "owner-a",
        name: "keyword block",
        event_type: 1,
        trigger_type: 1,
        trigger_metadata: {
            keyword_filter: ["blocked"],
            regex_patterns: [],
            allow_list: [],
        },
        actions: [{ type: 1 }],
        enabled: true,
        exempt_channels: [],
        exempt_roles: [],
        position: 0,
    };

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.AutomodRule, "findOneOrFail", async (options: { where?: { guild_id?: string; id?: string } }) => {
        findOneOrFailOptions.push(options);
        if (options.where?.guild_id === "guild-a" && options.where.id === "rule-a") return rule;

        throw new EntityNotFoundError(util.AutomodRule, options.where);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./rules")).default as express.Router;
    const app = express();
    app.use("/guilds/:guild_id/auto-moderation/rules", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get findOneOrFailOptions() {
            return findOneOrFailOptions;
        },
        get singleRuleGetRouteOptions() {
            return routeOptions.find((options) => {
                const routeOption = options as {
                    permission?: unknown;
                    requestBody?: unknown;
                    responses?: Record<number, { body?: string }>;
                };

                return !routeOption.requestBody && routeOption.responses?.[200]?.body === "AutomodRuleResponse";
            });
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}

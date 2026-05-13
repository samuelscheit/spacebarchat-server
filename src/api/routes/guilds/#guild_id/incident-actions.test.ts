import assert from "node:assert/strict";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./incident-actions");
const fixedNow = Date.parse("2026-05-13T10:00:00.000Z");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /guilds/:guild_id/incident-actions", () => {
    test("uses MANAGE_GUILD metadata and declares incident action schemas", (t) => {
        const harness = setupIncidentActionsRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            requestBody: "AutomodIncidentActionsSchema",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "AutomodIncidentActionsResponse",
                },
                400: {
                    body: "APIErrorResponse",
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

    test("persists invite and DM incident action timestamps and emits a guild update", async (t) => {
        const harness = setupIncidentActionsRoute(t, {
            incidents_data: {
                raid_detected_at: "2026-05-13T09:00:00.000Z",
                dm_spam_detected_at: null,
            },
        });

        const response = await requestJson(harness.app, "/guilds/guild-a/incident-actions", {
            invites_disabled_until: "2026-05-13T12:00:00.000Z",
            dms_disabled_until: "2026-05-13T13:30:00.000Z",
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            invites_disabled_until: "2026-05-13T12:00:00.000Z",
            dms_disabled_until: "2026-05-13T13:30:00.000Z",
        });
        assert.deepEqual(harness.findOneOrFailOptions, [
            {
                where: { id: "guild-a" },
                relations: { emojis: true, roles: true, stickers: true },
            },
        ]);
        assert.deepEqual(harness.guild.incidents_data, {
            raid_detected_at: "2026-05-13T09:00:00.000Z",
            dm_spam_detected_at: null,
            invites_disabled_until: "2026-05-13T12:00:00.000Z",
            dms_disabled_until: "2026-05-13T13:30:00.000Z",
        });
        assert.equal(harness.saveCount, 1);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "GUILD_UPDATE",
                guild_id: "guild-a",
                data: {
                    id: "guild-a",
                    name: "incident guild",
                    incidents_data: harness.guild.incidents_data,
                },
            },
        ]);
    });

    test("preserves omitted fields and clears nullable incident action timestamps", async (t) => {
        const harness = setupIncidentActionsRoute(t, {
            incidents_data: {
                invites_disabled_until: "2026-05-13T12:00:00.000Z",
                dms_disabled_until: "2026-05-13T13:30:00.000Z",
            },
        });

        const response = await requestJson(harness.app, "/guilds/guild-a/incident-actions", {
            dms_disabled_until: null,
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            invites_disabled_until: "2026-05-13T12:00:00.000Z",
            dms_disabled_until: null,
        });
        assert.deepEqual(harness.guild.incidents_data, {
            invites_disabled_until: "2026-05-13T12:00:00.000Z",
            dms_disabled_until: null,
        });
    });

    test("rejects incident action timestamps more than 24 hours into the future", async (t) => {
        const harness = setupIncidentActionsRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-a/incident-actions", {
            dms_disabled_until: "2026-05-14T10:00:00.001Z",
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.message, "Error: DMs disabled until time cannot exceed 24 hours into the future");
        assert.equal(harness.saveCount, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });
});

function setupIncidentActionsRoute(t: TestContext, guildOverrides: Partial<IncidentActionsTestGuild> = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../util/util/Event");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const emitEventCalls: unknown[] = [];
    const findOneOrFailOptions: unknown[] = [];
    let saveCount = 0;
    const guild: IncidentActionsTestGuild = {
        id: "guild-a",
        name: "incident guild",
        incidents_data: null,
        async save() {
            saveCount += 1;
            return this;
        },
        toGuildUpdateEventData() {
            return {
                id: this.id,
                name: this.name,
                incidents_data: this.incidents_data,
            };
        },
        ...guildOverrides,
    };

    t.mock.method(Date, "now", () => fixedNow);
    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Guild, "findOneOrFail", async (options: unknown) => {
        findOneOrFailOptions.push(options);
        return guild;
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./incident-actions")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use("/guilds/:guild_id/incident-actions", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        guild,
        routeOptions,
        emitEventCalls,
        findOneOrFailOptions,
        get saveCount() {
            return saveCount;
        },
    };
}

interface IncidentActionsTestGuild {
    id: string;
    name: string;
    incidents_data: Record<string, unknown> | null;
    save(): Promise<IncidentActionsTestGuild>;
    toGuildUpdateEventData(): Record<string, unknown>;
}

async function requestJson(app: express.Express, requestPath: string, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}

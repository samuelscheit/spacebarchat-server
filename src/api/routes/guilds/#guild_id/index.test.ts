import assert from "node:assert/strict";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./index");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PATCH /guilds/:guild_id safety_alerts_channel_id", () => {
    test("validates and emits a configured safety alerts channel id", async (t) => {
        const harness = setupGuildPatchRoute(t, { safety_alerts_channel_id: "123456789012345678" });

        const response = await requestJson(harness.app, "/guilds/guild-id", {
            method: "PATCH",
            body: { safety_alerts_channel_id: "123456789012345678" },
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.safety_alerts_channel_id, "123456789012345678");
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { guild_id: "guild-id", id: "123456789012345678" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(harness.assignedBodies, [{ safety_alerts_channel_id: "123456789012345678" }]);
        assert.equal(harness.saveCount, 1);
        assert.equal(harness.events[0]?.event, "GUILD_UPDATE");
        assert.equal(harness.events[0]?.guild_id, "guild-id");
        assert.equal((harness.events[0]?.data as { safety_alerts_channel_id?: unknown }).safety_alerts_channel_id, "123456789012345678");
    });

    test("clears safety alerts channel id without validating null as a channel id", async (t) => {
        const harness = setupGuildPatchRoute(t, { safety_alerts_channel_id: null });

        const response = await requestJson(harness.app, "/guilds/guild-id", {
            method: "PATCH",
            body: { safety_alerts_channel_id: null },
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.safety_alerts_channel_id, null);
        assert.deepEqual(harness.channelFindOptions, []);
        assert.deepEqual(harness.assignedBodies, [{ safety_alerts_channel_id: null }]);
        assert.equal(harness.saveCount, 1);
        assert.equal((harness.events[0]?.data as { safety_alerts_channel_id?: unknown }).safety_alerts_channel_id, null);
    });

    test("does not save or emit when the configured safety alerts channel is missing", async (t) => {
        const harness = setupGuildPatchRoute(t, { safety_alerts_channel_id: "123456789012345678", channelLookupError: new Error("missing channel") });

        const response = await requestJson(harness.app, "/guilds/guild-id", {
            method: "PATCH",
            body: { safety_alerts_channel_id: "123456789012345678" },
        });

        assert.equal(response.status, 500);
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { guild_id: "guild-id", id: "123456789012345678" },
                select: { id: true },
            },
        ]);
        assert.equal(harness.saveCount, 0);
        assert.deepEqual(harness.events, []);
    });
});

type SetupOptions = {
    safety_alerts_channel_id: string | null;
    channelLookupError?: Error;
};

function setupGuildPatchRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule("../../../util/handlers/route") as typeof import("../../../util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const permissionsModule = requireModule("../../../../util/util/Permissions") as typeof import("../../../../util/util/Permissions");
    const rightsModule = requireModule("../../../../util/util/Rights") as typeof import("../../../../util/util/Rights");
    const eventModule = requireModule("../../../../util/util/Event") as typeof import("../../../../util/util/Event");

    const events: unknown[] = [];
    const assignedBodies: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    let saveCount = 0;
    let guildFindCount = 0;

    const guild = {
        id: "guild-id",
        features: [],
        icon: null,
        banner: null,
        splash: null,
        discovery_splash: null,
        safety_alerts_channel_id: "existing-channel-id" as string | null,
        channel_ordering: ["existing-channel-id"],
        assign(body: Record<string, unknown>) {
            assignedBodies.push({ ...body });
            Object.assign(this, body);
            return this;
        },
        toGuildUpdateEventData() {
            return {
                id: this.id,
                safety_alerts_channel_id: this.safety_alerts_channel_id ?? null,
            };
        },
        async save() {
            saveCount += 1;
            return this;
        },
    };

    t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
    t.mock.method(rightsModule, "getRights", async () => ({ has: () => false }));
    t.mock.method(permissionsModule, "getPermission", async () => ({ has: (permission: string) => permission === "MANAGE_GUILD" }));
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        events.push(event);
    });
    t.mock.method(util.Guild, "findOneOrFail", async () => {
        guildFindCount += 1;
        if (guildFindCount === 1) return guild;
        return { channel_ordering: ["existing-channel-id"] };
    });
    t.mock.method(util.Channel, "findOneOrFail", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        if (options.channelLookupError) throw options.channelLookupError;
        return { id: options.safety_alerts_channel_id };
    });

    delete require.cache[routeModulePath];
    const router = requireModule(routeModulePath).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = "user-id";
        next();
    });
    app.use("/guilds/:guild_id", router);
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ message: error.message });
    });

    return {
        app,
        get assignedBodies() {
            return assignedBodies;
        },
        get channelFindOptions() {
            return channelFindOptions;
        },
        get events() {
            return events as { event?: string; guild_id?: string; data?: unknown }[];
        },
        get saveCount() {
            return saveCount;
        },
    };
}

async function requestJson(app: express.Express, path: string, options: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}

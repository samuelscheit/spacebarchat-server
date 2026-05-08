import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import { Application, DiscordApiErrors, Guild } from "@spacebar/util";
import router, { getCurrentBotApplication } from "./@me";

function createApp(userId = "bot-user-id", userBot = true) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.user_bot = userBot;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/@me", router);
    app.use((error: { code?: number | string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(400).json({ code: error.code, message: error.message });
    });

    return app;
}

async function requestJson(app: express.Express, path: string, init?: RequestInit) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
        const body = (await response.json()) as unknown;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /applications/@me", () => {
    test("loads the application for the authenticated bot user with owner and bot relations", async (t) => {
        const application = { id: "bot-user-id", bot: { id: "bot-user-id" }, owner: { id: "owner-id" } };
        const findOneOrFail = t.mock.method(Application, "findOneOrFail", async () => application);

        assert.equal(await getCurrentBotApplication("bot-user-id", true), application);
        assert.deepEqual(findOneOrFail.mock.calls[0].arguments[0], {
            where: { id: "bot-user-id" },
            relations: { owner: true, bot: true },
        });
    });

    test("rejects non-bot authenticated users before looking up an application row", async (t) => {
        const findOneOrFail = t.mock.method(Application, "findOneOrFail", async () => {
            throw new Error("non-bot users should be rejected before Application lookup");
        });

        await assert.rejects(
            () => getCurrentBotApplication("user-id", false),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );
        assert.equal(findOneOrFail.mock.callCount(), 0);
    });

    test("rejects a user-owned application that is not the current bot application", async (t) => {
        t.mock.method(Application, "findOneOrFail", async () => ({ id: "user-id", owner: { id: "user-id" }, bot: undefined }));

        await assert.rejects(
            () => getCurrentBotApplication("user-id", true),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );
    });

    test("rejects an application whose bot relation does not match the authenticated user", async (t) => {
        t.mock.method(Application, "findOneOrFail", async () => ({ id: "app-id", owner: { id: "owner-id" }, bot: { id: "different-bot-id" } }));

        await assert.rejects(
            () => getCurrentBotApplication("app-id", true),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );
    });

    test("returns bot-only error from the mounted route for non-bot tokens without looking up an application", async (t) => {
        const findOneOrFail = t.mock.method(Application, "findOneOrFail", async () => {
            throw new Error("non-bot route requests should be rejected before Application lookup");
        });

        const response = await requestJson(createApp("user-id", false), "/applications/@me");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.BOT_ONLY_ENDPOINT.code,
            message: DiscordApiErrors.BOT_ONLY_ENDPOINT.message,
        });
        assert.equal(findOneOrFail.mock.callCount(), 0);
    });

    test("returns the current bot application from the mounted route", async (t) => {
        t.mock.method(Application, "findOneOrFail", async () => ({ id: "bot-user-id", name: "Bot App", bot: { id: "bot-user-id" }, owner: { id: "owner-id" } }));

        const response = await requestJson(createApp(), "/applications/@me");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "bot-user-id",
            name: "Bot App",
            bot: { id: "bot-user-id" },
            owner: { id: "owner-id" },
        });
    });

    test("authorizes guild linking against the application owner for bot-token PATCH", async (t) => {
        const bot = { id: "bot-user-id", assign: t.mock.fn(), save: t.mock.fn(async () => undefined) };
        const application = {
            id: "bot-user-id",
            bot,
            owner: { id: "owner-id" },
            assign: t.mock.fn(),
            save: t.mock.fn(async () => undefined),
        };
        const findOneOrFail = t.mock.method(Application, "findOneOrFail", async () => application);
        const guildFindOneOrFail = t.mock.method(Guild, "findOneOrFail", async () => ({ owner_id: "owner-id" }));

        const response = await requestJson(createApp(), "/applications/@me", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ guild_id: "guild-id", description: "updated" }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(guildFindOneOrFail.mock.calls[0].arguments[0], {
            where: { id: "guild-id" },
            select: { owner_id: true },
        });
        assert.equal(findOneOrFail.mock.callCount(), 1);
        assert.deepEqual(bot.assign.mock.calls[0].arguments[0], { bio: "updated" });
        assert.equal(application.assign.mock.calls[0].arguments[0].guild_id, "guild-id");
        assert.equal(application.assign.mock.calls[0].arguments[0].description, "updated");
        assert.equal(bot.save.mock.callCount(), 1);
        assert.equal(application.save.mock.callCount(), 1);
    });

    test("rejects guild linking when the current application owner does not own the guild", async (t) => {
        const bot = { id: "bot-user-id", assign: t.mock.fn(), save: t.mock.fn(async () => undefined) };
        const application = {
            id: "bot-user-id",
            bot,
            owner: { id: "owner-id" },
            assign: t.mock.fn(),
            save: t.mock.fn(async () => undefined),
        };
        t.mock.method(Application, "findOneOrFail", async () => application);
        t.mock.method(Guild, "findOneOrFail", async () => ({ owner_id: "different-owner-id" }));

        const response = await requestJson(createApp(), "/applications/@me", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ guild_id: "guild-id", description: "updated" }),
        });

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 400,
            message: "You must be the owner of the guild to link it to an application",
        });
        assert.equal(bot.assign.mock.callCount(), 0);
        assert.equal(bot.save.mock.callCount(), 0);
        assert.equal(application.assign.mock.callCount(), 0);
        assert.equal(application.save.mock.callCount(), 0);
    });
});

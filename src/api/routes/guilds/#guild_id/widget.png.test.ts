import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express from "express";
import { Guild } from "@spacebar/util";
import { ErrorHandler } from "../../../middlewares";
import widgetPngRouter from "./widget.png";

describe("GET /guilds/:guild_id/widget.png", () => {
    test("does not attach successful PNG cache headers to render errors", async (t) => {
        t.mock.method(Guild, "findOneOrFail", async () => ({
            widget_enabled: false,
        }));

        const { server, url } = await startWidgetPngServer();

        try {
            const response = await fetch(`${url}/guild-disabled/widget.png?style=shield`);

            assert.notEqual(response.status, 200);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/);
            assert.doesNotMatch(response.headers.get("cache-control") ?? "", /public/);
            assert.doesNotMatch(response.headers.get("cache-control") ?? "", /immutable/);
            await response.json();
        } finally {
            await close(server);
        }
    });
});

async function startWidgetPngServer() {
    const app = express();
    app.use("/guilds/:guild_id/widget.png", widgetPngRouter);
    app.use(ErrorHandler);

    const server = createServer(app);
    const port = await listen(server);

    return {
        server,
        url: `http://127.0.0.1:${port}/guilds`,
    };
}

async function listen(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address && typeof address === "object");
    return address.port;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

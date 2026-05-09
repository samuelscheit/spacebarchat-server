import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import guildAffinitiesRouter from "../../../routes/users/@me/affinities/guilds";

describe("GET /users/@me/affinities/guilds", () => {
    test("returns the Discord-compatible empty guild affinities payload", async () => {
        const app = express();
        app.use("/users/@me/affinities/guilds", guildAffinitiesRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/affinities/guilds`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { guild_affinities: [] });
        } finally {
            await close(server);
        }
    });
});

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

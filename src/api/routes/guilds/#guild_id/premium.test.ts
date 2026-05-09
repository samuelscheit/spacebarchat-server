import { describe, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";
import premiumRouter from "./premium";

function listen(server: http.Server) {
    return new Promise<number>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            resolve((server.address() as AddressInfo).port);
        });
    });
}

function close(server: http.Server) {
    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

describe("GET /guilds/:guild_id/premium/subscriptions", () => {
    test("returns an empty subscription list until premium guild subscriptions are persisted", async (t) => {
        const app = express();
        app.use("/guilds/:guild_id/premium", premiumRouter);

        const server = http.createServer(app);
        t.after(() => close(server));
        const port = await listen(server);

        const response = await fetch(`http://127.0.0.1:${port}/guilds/999999999999999999/premium/subscriptions`);

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), []);
    });

    test("documents the compatibility stub instead of leaving an anonymous TODO", () => {
        const source = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "premium.ts"), "utf8");

        assert.doesNotMatch(source, /\/\/ TODO:\s*(?:\r?\n|$)/);
        assert.match(source, /does not persist Discord premium guild subscription records yet/);
    });
});

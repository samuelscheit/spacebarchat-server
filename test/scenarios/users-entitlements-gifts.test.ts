import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express from "express";
import entitlementsRouter from "../../src/api/routes/users/@me/entitlements";

const coveredManifestIds = ["api:http:GET:/users/@me/entitlements/gifts"];

describe("GET /users/@me/entitlements/gifts", () => {
    test("returns the current empty giftable entitlements list", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/entitlements/gifts"]);

        const app = express();
        app.use("/users/@me/entitlements", entitlementsRouter);
        const server = createServer(app);
        const port = await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${port}/users/@me/entitlements/gifts`);

            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type") ?? "", /application\/json/);
            assert.deepEqual(await response.json(), []);
        } finally {
            await close(server);
        }
    });
});

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

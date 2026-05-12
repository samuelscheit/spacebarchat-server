import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express from "express";
import entitlementsRouter from "../../src/api/routes/users/@me/entitlements";

const coveredManifestIds = ["api:http:GET:/users/@me/entitlements/", "api:http:GET:/users/@me/entitlements/gift-codes", "api:http:GET:/users/@me/entitlements/gifts"];

describe("GET /users/@me/entitlements", () => {
    test("returns the current empty entitlements and gift code lists", async () => {
        assert.deepEqual(coveredManifestIds, [
            "api:http:GET:/users/@me/entitlements/",
            "api:http:GET:/users/@me/entitlements/gift-codes",
            "api:http:GET:/users/@me/entitlements/gifts",
        ]);

        const app = express();
        app.use("/users/@me/entitlements", entitlementsRouter);
        const server = createServer(app);
        const port = await listen(server);

        try {
            const entitlementsResponse = await fetch(
                `http://127.0.0.1:${port}/users/@me/entitlements?with_sku=false&with_application=false&entitlement_type=11&exclude_ended=true`,
            );
            const giftCodesResponse = await fetch(`http://127.0.0.1:${port}/users/@me/entitlements/gift-codes?sku_ids=521847234246082599&subscription_plan_id=642251038925127690`);
            const giftsResponse = await fetch(`http://127.0.0.1:${port}/users/@me/entitlements/gifts`);

            assert.equal(entitlementsResponse.status, 200);
            assert.match(entitlementsResponse.headers.get("content-type") ?? "", /application\/json/);
            assert.deepEqual(await entitlementsResponse.json(), []);

            assert.equal(giftCodesResponse.status, 200);
            assert.match(giftCodesResponse.headers.get("content-type") ?? "", /application\/json/);
            assert.deepEqual(await giftCodesResponse.json(), []);

            assert.equal(giftsResponse.status, 200);
            assert.match(giftsResponse.headers.get("content-type") ?? "", /application\/json/);
            assert.deepEqual(await giftsResponse.json(), []);
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

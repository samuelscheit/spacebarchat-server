import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import applicationSubscriptionPlansRouter from "../../routes/store/published-listings/applications/#application_id/subscription-plans";

function createApp() {
    const app = express();
    app.use("/store/published-listings/applications/:application_id/subscription-plans", applicationSubscriptionPlansRouter);
    return app;
}

async function getJson(app: express.Express, path: string) {
    const server = await new Promise<Server>((resolve) => {
        const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /store/published-listings/applications/:application_id/subscription-plans", () => {
    test("returns no published subscription plans instead of fabricated placeholder data", async () => {
        const response = await getJson(createApp(), "/store/published-listings/applications/123456789012345678/subscription-plans");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import express from "express";
import activityStatisticsApplicationsRouter from "../../src/api/routes/users/@me/activities/statistics/applications";

describe("GET /users/@me/activities/statistics/applications", () => {
    test("returns the empty activity statistics compatibility response", async () => {
        const app = express();
        app.use("/users/@me/activities/statistics/applications", activityStatisticsApplicationsRouter);

        const response = await requestJson(app, "/users/@me/activities/statistics/applications/");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });
});

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}

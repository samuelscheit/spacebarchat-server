process.env.LOG_ROUTES = "false";

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import express from "express";
import unauthenticatedExperimentRouter from "../../routes/reporting/unauthenticated/experiment";

let server: http.Server;
let baseUrl: string;

async function requestExperiment() {
    const response = await fetch(`${baseUrl}/reporting/unauthenticated/experiment`, {
        method: "GET",
        headers: {
            accept: "application/json",
        },
    });

    return {
        response,
        body: (await response.json()) as unknown,
    };
}

before(async () => {
    const app = express();
    app.use("/reporting/unauthenticated/experiment", unauthenticatedExperimentRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo | null;
    assert(address);
    baseUrl = `http://${address.address}:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

describe("unauthenticated reporting experiment", () => {
    test("GET returns an empty eligibility object", async () => {
        const { response, body } = await requestExperiment();

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.deepEqual(body, {});
    });
});

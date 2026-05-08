import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import { describe, test } from "node:test";
import express from "express";
import licenseRouter from "./license";

describe("POST /warp/license", () => {
    test("acknowledges Discord client license checks without a response body", async () => {
        const app = express();
        app.use("/", licenseRouter);

        const server = http.createServer(app);
        const port = await listen(server);

        try {
            const response = await fetch(`http://127.0.0.1:${port}/`, { method: "POST" });

            assert.equal(response.status, 204);
            assert.equal(await response.text(), "");
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

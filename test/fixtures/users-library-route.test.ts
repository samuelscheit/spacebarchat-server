import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import libraryRouter from "../../src/api/routes/users/@me/library";

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

test("GET /users/@me/library preserves the empty compatibility response", async (t) => {
    const app = express();
    app.use("/", libraryRouter);

    const server = http.createServer(app);
    t.after(() => close(server));
    const port = await listen(server);

    const response = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
});

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, test } from "node:test";
import express, { Router } from "express";
import { API_PREFIXES, mountApiRouter } from "./util/ApiPrefixes";

describe("API_PREFIXES", () => {
    test("mounts heritage, current, and unversioned API prefixes", () => {
        assert.deepEqual(API_PREFIXES, ["/api/v3", "/api/v4", "/api/v5", "/api/v6", "/api/v7", "/api/v8", "/api/v9", "/api/v10", "/api"]);
    });

    test("routes heritage versions to the API router", async () => {
        const app = express();
        const api = Router();
        api.get("/ping", (req, res) => res.json({ ok: true, baseUrl: req.baseUrl }));
        mountApiRouter(app, api);

        const server = createServer(app);
        const port = await listen(server);

        try {
            for (const prefix of ["/api/v3", "/api/v4", "/api/v5"]) {
                const response = await fetch(`http://127.0.0.1:${port}${prefix}/ping`);
                assert.equal(response.status, 200);
                assert.deepEqual(await response.json(), { ok: true, baseUrl: prefix });
            }
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

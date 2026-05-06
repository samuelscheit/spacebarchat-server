import { describe, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { registerPublicAssetRoutes } from "./util/PublicAssetRoutes";

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

describe("public asset routes", () => {
    test("serves the verification response helper used by the verify email page", async (t) => {
        const publicAssetsFolder = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-public-assets-"));
        t.after(() => fs.rm(publicAssetsFolder, { recursive: true, force: true }));

        const helperBody = "globalThis.parseVerificationResponse = () => null;\n";
        await fs.writeFile(path.join(publicAssetsFolder, "verify-response.js"), helperBody);

        const app = express();
        registerPublicAssetRoutes(app, publicAssetsFolder);

        const server = http.createServer(app);
        t.after(() => close(server));
        const port = await listen(server);

        const response = await fetch(`http://127.0.0.1:${port}/verify-response.js`);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "public, max-age=21600");
        assert.equal(await response.text(), helperBody);
    });
});

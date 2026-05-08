import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import express, { NextFunction, Request, Response } from "express";
import { Config } from "@spacebar/util";

const requestSignature = "test-banner-upload-signature";
const animatedGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const staticPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

type ApiLikeError = Error & {
    code?: number;
    httpStatus?: number;
};

async function configureTestRuntime() {
    const root = await mkdtemp(path.join(tmpdir(), "spacebar-banner-route-"));
    const configPath = path.join(root, "config.json");
    const storagePath = path.join(root, "files");

    process.env.CONFIG_PATH = configPath;
    process.env.CONFIG_READONLY = "true";
    process.env.STORAGE_PROVIDER = "file";
    process.env.STORAGE_LOCATION = storagePath;

    await writeFile(
        configPath,
        JSON.stringify({
            general: {
                serverName: "http://localhost:3001",
            },
            api: {
                endpointPublic: "http://localhost:3001/api/v9",
            },
            security: {
                requestSignature,
            },
            cdn: {
                endpointPublic: "http://cdn.test",
                endpointPrivate: "http://cdn.test",
            },
            gateway: {
                endpointPublic: "ws://localhost:3002",
            },
        }),
    );
    await Config.init(true);

    return root;
}

async function createBannerTestServer() {
    const { default: bannersRoute } = require("./banners") as typeof import("./banners");
    const app = express();
    app.use("/banners", bannersRoute);
    app.use((error: ApiLikeError, _req: Request, res: Response, _next: NextFunction) => {
        res.status(error.httpStatus ?? 500).json({ code: error.code, message: error.message });
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }),
    };
}

async function uploadBanner(baseUrl: string, file: Buffer, name: string, type: string) {
    const body = new FormData();
    body.set("file", new Blob([Uint8Array.from(file)], { type }), name);

    return fetch(`${baseUrl}/banners/guild-id`, {
        method: "POST",
        headers: {
            signature: requestSignature,
        },
        body,
    });
}

describe("banner CDN route", () => {
    test("rejects animated uploads when banner animation is disabled without blocking static banners", async (t) => {
        const root = await configureTestRuntime();
        t.after(() => rm(root, { recursive: true, force: true }));

        Config.get().cdn.limits.banner.allowAnimated = "never";

        const server = await createBannerTestServer();
        t.after(server.close);

        const animatedResponse = await uploadBanner(server.baseUrl, animatedGif, "banner.gif", "image/gif");
        assert.equal(animatedResponse.status, 400);
        assert.deepEqual(await animatedResponse.json(), {
            code: 50035,
            message: "Invalid form body (returned for both application/json and multipart/form-data bodies), or invalid Content-Type provided",
        });

        const staticResponse = await uploadBanner(server.baseUrl, staticPng, "banner.png", "image/png");
        assert.equal(staticResponse.status, 200);
        const uploaded = (await staticResponse.json()) as { content_type?: string; id?: string };
        assert.equal(uploaded.content_type, "image/png");
        assert.equal(uploaded.id?.startsWith("a_"), false);
    });
});

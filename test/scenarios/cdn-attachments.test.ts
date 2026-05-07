import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Config } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { withFileStorage } from "../fixtures/files";
import { startCdn } from "../server/startCdn";

const requestSignature = "cdn-scenario-signature";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

const coveredManifestIds = [
    "cdn:http:POST:/attachments/:channel_id/:message_id",
    "cdn:http:GET:/attachments/:channel_id/:message_id/:filename",
    "cdn:http:DELETE:/attachments/:channel_id/:message_id/:filename",
];

const coveredIconManifestIds = ["cdn:http:POST:/icons/:guild_id", "cdn:http:GET:/icons/:guild_id/:hash", "cdn:http:DELETE:/icons/:guild_id/:id"];

test("CDN attachment upload, signed download, delete, and missing-object behavior run over HTTP", { timeout: 30_000 }, async () => {
    assert.deepEqual(coveredManifestIds, [
        "cdn:http:POST:/attachments/:channel_id/:message_id",
        "cdn:http:GET:/attachments/:channel_id/:message_id/:filename",
        "cdn:http:DELETE:/attachments/:channel_id/:message_id/:filename",
    ]);

    await withCdnConfig(async () => {
        await withFileStorage(async ({ storage }) => {
            const cdn = await startCdn();

            try {
                const upload = await postMultipart(`${cdn.baseUrl}/attachments/100000000000000001/100000000000000002`, png, "fixture image.png", "image/png");
                await assertStatus(upload, 200);
                const uploadBody = await assertJsonObject(upload);
                assert.equal(uploadBody.content_type, "image/png");
                assert.equal(uploadBody.filename, "fixture_image.png");
                assert.equal(uploadBody.path, "attachments/100000000000000001/100000000000000002/fixture_image.png");
                assert.equal(uploadBody.size, png.length);
                assert.equal(uploadBody.url, "https://cdn.example/attachments/100000000000000001/100000000000000002/fixture_image.png");
                assert.equal(await storage.exists(uploadBody.path as string), true);

                const downloadUrl = `${cdn.baseUrl}/attachments/100000000000000001/100000000000000002/fixture_image.png`;
                const rejectedDownload = await fetch(downloadUrl, { headers: { signature: "wrong-signature" } });
                await assertStatus(rejectedDownload, 404);
                assert.equal(await rejectedDownload.text(), "This content is no longer available.");

                const download = await fetch(downloadUrl, { headers: { signature: requestSignature } });
                await assertStatus(download, 200);
                assert.equal(download.headers.get("content-type"), "image/png");
                assert.equal(download.headers.get("cache-control"), "public, max-age=21600, s-maxage=21600, immutable");
                assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);

                const unsignedDelete = await fetch(downloadUrl, { method: "DELETE" });
                await assertStatus(unsignedDelete, 400);
                const unsignedDeleteBody = await assertJsonObject(unsignedDelete);
                assert.equal(unsignedDeleteBody.message, "Error: Invalid request signature");
                assert.equal(await storage.exists(uploadBody.path as string), true);

                const deleted = await fetch(downloadUrl, { method: "DELETE", headers: { signature: requestSignature } });
                await assertStatus(deleted, 200);
                assert.deepEqual(await assertJsonObject(deleted), { success: true });
                assert.equal(await storage.exists(uploadBody.path as string), false);

                const missing = await fetch(downloadUrl, { headers: { signature: requestSignature } });
                await assertStatus(missing, 404);
                const missingBody = await assertJsonObject(missing);
                assert.equal(missingBody.code, 404);
                assert.equal(missingBody.message, "Error: File not found");
            } finally {
                await cdn.stop();
            }
        });
    });
});

test("CDN icon upload, invalid file rejection, cached download, and cacheable missing-object behavior run over HTTP", { timeout: 30_000 }, async () => {
    assert.deepEqual(coveredIconManifestIds, ["cdn:http:POST:/icons/:guild_id", "cdn:http:GET:/icons/:guild_id/:hash", "cdn:http:DELETE:/icons/:guild_id/:id"]);

    await withCdnConfig(async () => {
        await withFileStorage(async ({ storage }) => {
            const cdn = await startCdn();

            try {
                const invalidUpload = await postMultipart(`${cdn.baseUrl}/icons/100000000000000003`, Buffer.from("not an image"), "invalid.txt", "text/plain");
                await assertStatus(invalidUpload, 400);
                const invalidUploadBody = await assertJsonObject(invalidUpload);
                assert.equal(invalidUploadBody.message, "Error: Invalid file type");

                const upload = await postMultipart(`${cdn.baseUrl}/icons/100000000000000003`, png, "icon.png", "image/png");
                await assertStatus(upload, 200);
                const uploadBody = await assertJsonObject(upload);
                assert.equal(uploadBody.content_type, "image/png");
                assert.equal(uploadBody.size, png.length);
                assert.equal(uploadBody.url, `https://cdn.example/icons/100000000000000003/${uploadBody.id}`);
                assert.equal(await storage.exists(`icons/100000000000000003/${uploadBody.id}`), true);

                const downloadUrl = `${cdn.baseUrl}/icons/100000000000000003/${uploadBody.id}.png`;
                const download = await fetch(downloadUrl);
                await assertStatus(download, 200);
                assert.equal(download.headers.get("content-type"), "image/png");
                assert.equal(download.headers.get("cache-control"), "public, max-age=21600, s-maxage=21600, immutable");
                assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);

                const deleted = await fetch(`${cdn.baseUrl}/icons/100000000000000003/${uploadBody.id}`, {
                    method: "DELETE",
                    headers: { signature: requestSignature },
                });
                await assertStatus(deleted, 200);
                assert.deepEqual(await assertJsonObject(deleted), { success: true });
                assert.equal(await storage.exists(`icons/100000000000000003/${uploadBody.id}`), false);

                const missing = await fetch(downloadUrl);
                await assertStatus(missing, 404);
                assert.equal(missing.headers.get("cache-control"), "public, max-age=60, s-maxage=60, immutable");
                assert.equal(await missing.text(), `/100000000000000003/${uploadBody.id}.png not found`);
            } finally {
                await cdn.stop();
            }
        });
    });
});

async function postMultipart(url: string, buffer: Buffer, filename: string, mimetype: string) {
    const form = new FormData();
    const bytes = new Uint8Array(buffer.length);
    bytes.set(buffer);
    form.set("file", new Blob([bytes], { type: mimetype }), filename);

    return await fetch(url, {
        method: "POST",
        headers: { signature: requestSignature },
        body: form,
    });
}

async function withCdnConfig<T>(fn: () => Promise<T>): Promise<T> {
    const directory = await mkdtemp(path.join(tmpdir(), "spacebar-cdn-scenario-config-"));
    const configPath = path.join(directory, "config.json");
    const previous = snapshotProcessState();

    try {
        process.env.CONFIG_PATH = configPath;
        process.env.CONFIG_READONLY = "true";
        process.env.LOG_ROUTES = "false";
        await writeFile(
            configPath,
            JSON.stringify({
                general: { serverName: "localhost" },
                api: { endpointPublic: "http://localhost:3001/api/v9" },
                cdn: { endpointPublic: "https://cdn.example", endpointPrivate: "http://127.0.0.1:3003", maxAttachmentSize: 1024 * 1024 },
                gateway: { endpointPublic: "ws://localhost:3002" },
                security: { requestSignature, cdnSignUrls: true },
            }),
        );
        await Config.init(true);

        return await fn();
    } finally {
        restoreProcessState(previous);
        await rm(directory, { recursive: true, force: true });
    }
}

function snapshotProcessState() {
    return {
        CONFIG_PATH: process.env.CONFIG_PATH,
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        LOG_ROUTES: process.env.LOG_ROUTES,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("CONFIG_READONLY", state.CONFIG_READONLY);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CloudAttachment, closeDatabase, Config, initDatabase } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeChannel, makeGuild, makeUser } from "../fixtures/entities";
import { withFileStorage } from "../fixtures/files";
import { startCdn } from "../server/startCdn";

const requestSignature = "cdn-scenario-signature";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

const coveredManifestIds = [
    "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:message_id",
    "cdn:http:GET:/attachments/:channel_id/:message_id/:filename",
    "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:message_id/:filename",
];

const coveredIconManifestIds = ["cdn:http:POST:/icons/:guild_id", "cdn:http:GET:/icons/:guild_id/:hash", "cdn:http:DELETE:/icons/:guild_id/:id"];

const coveredInternalAttachmentManifestIds = [
    "cdn:http:PUT:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
    "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
    "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
];

test("CDN attachment upload, signed download, delete, and missing-object behavior run over HTTP", { timeout: 30_000 }, async () => {
    assert.deepEqual(coveredManifestIds, [
        "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:message_id",
        "cdn:http:GET:/attachments/:channel_id/:message_id/:filename",
        "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:message_id/:filename",
    ]);

    await withCdnConfig(async () => {
        await withFileStorage(async ({ storage }) => {
            const cdn = await startCdn();

            try {
                const mutationUrl = `${cdn.baseUrl}/_spacebar/cdn/attachments/100000000000000001/100000000000000002`;
                const upload = await postMultipart(mutationUrl, png, "fixture image.png", "image/png");
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

                const deleteUrl = `${mutationUrl}/fixture_image.png`;
                const unsignedDelete = await fetch(deleteUrl, { method: "DELETE" });
                await assertStatus(unsignedDelete, 400);
                const unsignedDeleteBody = await assertJsonObject(unsignedDelete);
                assert.equal(unsignedDeleteBody.message, "Error: Invalid request signature");
                assert.equal(await storage.exists(uploadBody.path as string), true);

                const deleted = await fetch(deleteUrl, { method: "DELETE", headers: { signature: requestSignature } });
                await assertStatus(deleted, 200);
                assert.deepEqual(await assertJsonObject(deleted), { success: true, deleted: true });
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

test(
    "CDN internal cloud attachment upload, clone, delete, and oversized rejection run over HTTP",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredInternalAttachmentManifestIds, [
            "cdn:http:PUT:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
            "cdn:http:POST:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename/clone_to_message/:message_id",
            "cdn:http:DELETE:/_spacebar/cdn/attachments/:channel_id/:batch_id/:attachment_id/:filename",
        ]);

        await withCdnConfig(async () => {
            await withCdnDatabase("spacebar_cdn_cloud_attachment", async () => {
                await withFileStorage(async ({ storage }) => {
                    const cdn = await startCdn();

                    try {
                        const fixture = await createCloudAttachmentFixture({ filename: "cloud.png" });
                        const uploadUrl = `${cdn.baseUrl}/_spacebar/cdn/attachments/${fixture.uploadFilename}`;
                        const upload = await putBytes(uploadUrl, png, "image/png");
                        await assertStatus(upload, 200);
                        assert.equal(await upload.text(), "");

                        const uploaded = await CloudAttachment.findOneByOrFail({ id: fixture.attachment.id });
                        assert.equal(uploaded.size, png.length);
                        assert.equal(uploaded.contentType, "image/png");
                        assert.equal(uploaded.width, 1);
                        assert.equal(uploaded.height, 1);
                        assert.equal(await storage.exists(`attachments/${fixture.uploadFilename}`), true);
                        assert.deepEqual(await storage.get(`attachments/${fixture.uploadFilename}`), png);

                        const messageId = "100000000000000999";
                        const cloneUrl = `${uploadUrl}/clone_to_message/${messageId}`;
                        const unsignedClone = await fetch(cloneUrl, { method: "POST" });
                        await assertStatus(unsignedClone, 400);
                        const unsignedCloneBody = await assertJsonObject(unsignedClone);
                        assert.equal(unsignedCloneBody.message, "Error: Invalid request signature");

                        const clone = await fetch(cloneUrl, { method: "POST", headers: { signature: requestSignature } });
                        await assertStatus(clone, 200);
                        const cloneBody = await assertJsonObject(clone);
                        const clonedPath = `attachments/${fixture.channelId}/${messageId}/${fixture.filename}`;
                        assert.deepEqual(cloneBody, { success: true, new_path: clonedPath });
                        assert.equal(await storage.exists(clonedPath), true);
                        assert.deepEqual(await storage.get(clonedPath), png);

                        const unsignedDelete = await fetch(uploadUrl, { method: "DELETE" });
                        await assertStatus(unsignedDelete, 400);
                        const unsignedDeleteBody = await assertJsonObject(unsignedDelete);
                        assert.equal(unsignedDeleteBody.message, "Error: Invalid request signature");
                        assert.notEqual(await CloudAttachment.findOneBy({ id: fixture.attachment.id }), null);
                        assert.equal(await storage.exists(`attachments/${fixture.uploadFilename}`), true);

                        const deleted = await fetch(uploadUrl, { method: "DELETE", headers: { signature: requestSignature } });
                        await assertStatus(deleted, 200);
                        assert.deepEqual(await assertJsonObject(deleted), { success: true, deleted: true });
                        assert.equal(await CloudAttachment.findOneBy({ id: fixture.attachment.id }), null);
                        assert.equal(await storage.exists(`attachments/${fixture.uploadFilename}`), false);
                        assert.equal(await storage.exists(clonedPath), true);

                        const missingSource = await createCloudAttachmentFixture({ attachmentId: "missing-source", filename: "missing.bin" });
                        const missingSourceUrl = `${cdn.baseUrl}/_spacebar/cdn/attachments/${missingSource.uploadFilename}`;
                        const missingClone = await fetch(`${missingSourceUrl}/clone_to_message/${messageId}`, {
                            method: "POST",
                            headers: { signature: requestSignature },
                        });
                        await assertStatus(missingClone, 404);
                        assert.equal(await missingClone.text(), "Attachment file not found");
                        assert.notEqual(await CloudAttachment.findOneBy({ id: missingSource.attachment.id }), null);

                        const staleDelete = await fetch(missingSourceUrl, { method: "DELETE", headers: { signature: requestSignature } });
                        await assertStatus(staleDelete, 200);
                        assert.deepEqual(await assertJsonObject(staleDelete), { success: true, deleted: false });
                        assert.equal(await CloudAttachment.findOneBy({ id: missingSource.attachment.id }), null);

                        const oversized = await createCloudAttachmentFixture({ attachmentId: "oversized", filename: "oversized.bin" });
                        const oversizedUrl = `${cdn.baseUrl}/_spacebar/cdn/attachments/${oversized.uploadFilename}`;
                        const rejectedUpload = await putBytes(oversizedUrl, Buffer.alloc(Config.get().cdn.maxAttachmentSize + 1, 0x61));
                        await assertStatus(rejectedUpload, 413);
                        assert.equal(await rejectedUpload.text(), "File too large");
                        const unchanged = await CloudAttachment.findOneByOrFail({ id: oversized.attachment.id });
                        assert.equal(unchanged.size, null);
                        assert.equal(unchanged.contentType, null);
                        assert.equal(await storage.exists(`attachments/${oversized.uploadFilename}`), false);
                    } finally {
                        await cdn.stop();
                    }
                });
            });
        });
    },
);

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

async function putBytes(url: string, buffer: Buffer, contentType = "application/octet-stream") {
    return await fetch(url, {
        method: "PUT",
        headers: {
            "content-length": String(buffer.length),
            "content-type": contentType,
        },
        body: buffer,
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

async function withCdnDatabase<T>(prefix: string, fn: () => Promise<T>): Promise<T> {
    const database = await createDisposablePostgresDatabase({ prefix });

    try {
        process.env.DATABASE = database.url;
        process.env.APPLY_DB_MIGRATIONS = "true";
        delete process.env.DB_SYNC;
        await initDatabase();

        return await fn();
    } finally {
        await closeDatabase();
        await database.close();
    }
}

async function createCloudAttachmentFixture(options: { attachmentId?: string; filename: string }) {
    const channelId = "100000000000000101";
    const user = await makeUser({ id: "100000000000000100" }).save();
    const guild = await makeGuild(user, { id: "100000000000000102" }).save();
    const channel = await makeChannel(guild, { id: channelId }).save();
    const batchId = `CLOUD_${user.id}_scenario`;
    const attachmentId = options.attachmentId ?? "0";
    const uploadFilename = `${channel.id}/${batchId}/${attachmentId}/${options.filename}`;
    const attachment = await CloudAttachment.create({
        user,
        channel,
        uploadFilename,
        userAttachmentId: attachmentId,
        userFilename: options.filename,
        userFileSize: png.length,
    }).save();

    return { attachment, uploadFilename, channelId, batchId, attachmentId, filename: options.filename };
}

function snapshotProcessState() {
    return {
        CONFIG_PATH: process.env.CONFIG_PATH,
        CONFIG_READONLY: process.env.CONFIG_READONLY,
        LOG_ROUTES: process.env.LOG_ROUTES,
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        DB_SYNC: process.env.DB_SYNC,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("CONFIG_READONLY", state.CONFIG_READONLY);
    restoreEnv("LOG_ROUTES", state.LOG_ROUTES);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("DB_SYNC", state.DB_SYNC);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { FileStorage } from "@spacebar/cdn";
import { Config } from "@spacebar/util";
import { assertJsonObject, assertStatus } from "../assertions/http";
import { createCdnObject, withFileStorage } from "../fixtures/files";
import { startCdn } from "../server/startCdn";

type StartedCdn = Awaited<ReturnType<typeof startCdn>>;
type TestStorage = Pick<FileStorage, "exists" | "get">;

type HashAssetFamily = {
    name: string;
    basePath: string;
    storagePrefix: string;
    storedName?: (id: string) => string;
    assertUnsignedDelete?: boolean;
};

type SingleAssetFamily = {
    name: string;
    basePath: string;
    storagePath: string;
    deletePath?: string;
};

const requestSignature = "cdn-assets-scenario-signature";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const pngHash = createHash("md5").update(png).digest("hex");
const cacheHeader = "public, max-age=21600, s-maxage=21600, immutable";

const coveredManifestIds = [
    "cdn:http:DELETE:/app-assets/:guild_id/:id",
    "cdn:http:DELETE:/app-icons/:guild_id/:id",
    "cdn:http:DELETE:/avatars/:user_id/:id",
    "cdn:http:DELETE:/banners/:guild_id/:id",
    "cdn:http:DELETE:/channel-icons/:guild_id/:id",
    "cdn:http:DELETE:/discover-splashes/:guild_id/:id",
    "cdn:http:DELETE:/discovery-splashes/:guild_id/:id",
    "cdn:http:DELETE:/emojis/:emoji_id",
    "cdn:http:DELETE:/guild-profiles/:id",
    "cdn:http:DELETE:/guilds/:guild_id/users/:user_id/avatars/:id",
    "cdn:http:DELETE:/guilds/:guild_id/users/:user_id/banners/:id",
    "cdn:http:DELETE:/role-icons/:role_id/:id",
    "cdn:http:DELETE:/splashes/:guild_id/:id",
    "cdn:http:DELETE:/stickers/:sticker_id/",
    "cdn:http:DELETE:/team-icons/:guild_id/:id",
    "cdn:http:GET:/app-assets/:guild_id",
    "cdn:http:GET:/app-assets/:guild_id/:hash",
    "cdn:http:GET:/app-icons/:guild_id",
    "cdn:http:GET:/app-icons/:guild_id/:hash",
    "cdn:http:GET:/avatar-decoration-presets/:avatar_decoration_data_asset",
    "cdn:http:GET:/avatars/:user_id",
    "cdn:http:GET:/avatars/:user_id/:hash",
    "cdn:http:GET:/badge-icons/:badge_id",
    "cdn:http:GET:/banners/:guild_id",
    "cdn:http:GET:/banners/:guild_id/:hash",
    "cdn:http:GET:/channel-icons/:guild_id",
    "cdn:http:GET:/channel-icons/:guild_id/:hash",
    "cdn:http:GET:/discover-splashes/:guild_id",
    "cdn:http:GET:/discover-splashes/:guild_id/:hash",
    "cdn:http:GET:/discovery-splashes/:guild_id",
    "cdn:http:GET:/discovery-splashes/:guild_id/:hash",
    "cdn:http:GET:/embed/avatars/:id",
    "cdn:http:GET:/embed/group-avatars/:id",
    "cdn:http:GET:/emojis/:emoji_id",
    "cdn:http:GET:/guild-profiles/",
    "cdn:http:GET:/guild-profiles/:hash",
    "cdn:http:GET:/guilds/:guild_id/users/:user_id/avatars/",
    "cdn:http:GET:/guilds/:guild_id/users/:user_id/avatars/:hash",
    "cdn:http:GET:/guilds/:guild_id/users/:user_id/banners/",
    "cdn:http:GET:/guilds/:guild_id/users/:user_id/banners/:hash",
    "cdn:http:GET:/icons/:guild_id",
    "cdn:http:GET:/ping/",
    "cdn:http:GET:/role-icons/:role_id",
    "cdn:http:GET:/role-icons/:role_id/:hash",
    "cdn:http:GET:/splashes/:guild_id",
    "cdn:http:GET:/splashes/:guild_id/:hash",
    "cdn:http:GET:/stickers/:sticker_id",
    "cdn:http:GET:/team-icons/:guild_id",
    "cdn:http:GET:/team-icons/:guild_id/:hash",
    "cdn:http:POST:/app-assets/:guild_id",
    "cdn:http:POST:/app-icons/:guild_id",
    "cdn:http:POST:/avatars/:user_id",
    "cdn:http:POST:/banners/:guild_id",
    "cdn:http:POST:/channel-icons/:guild_id",
    "cdn:http:POST:/discover-splashes/:guild_id",
    "cdn:http:POST:/discovery-splashes/:guild_id",
    "cdn:http:POST:/emojis/:emoji_id",
    "cdn:http:POST:/guild-profiles/",
    "cdn:http:POST:/guilds/:guild_id/users/:user_id/avatars/",
    "cdn:http:POST:/guilds/:guild_id/users/:user_id/banners/",
    "cdn:http:POST:/role-icons/:role_id",
    "cdn:http:POST:/splashes/:guild_id",
    "cdn:http:POST:/stickers/:sticker_id",
    "cdn:http:POST:/team-icons/:guild_id",
];

const hashAssetFamilies: HashAssetFamily[] = [
    { name: "app asset", basePath: "/app-assets/100000000000001001", storagePrefix: "app-assets/100000000000001001" },
    { name: "app icon", basePath: "/app-icons/100000000000001002", storagePrefix: "app-icons/100000000000001002" },
    { name: "avatar", basePath: "/avatars/100000000000001003", storagePrefix: "avatars/100000000000001003", assertUnsignedDelete: true },
    { name: "banner", basePath: "/banners/100000000000001004", storagePrefix: "banners/100000000000001004" },
    { name: "channel icon", basePath: "/channel-icons/100000000000001005", storagePrefix: "channel-icons/100000000000001005" },
    { name: "discover splash", basePath: "/discover-splashes/100000000000001006", storagePrefix: "discover-splashes/100000000000001006" },
    { name: "discovery splash", basePath: "/discovery-splashes/100000000000001007", storagePrefix: "discovery-splashes/100000000000001007" },
    { name: "guild profile", basePath: "/guild-profiles", storagePrefix: "guild-profiles" },
    {
        name: "guild member avatar",
        basePath: "/guilds/100000000000001008/users/100000000000001009/avatars",
        storagePrefix: "guilds/100000000000001008/users/100000000000001009/avatars",
    },
    {
        name: "guild member banner",
        basePath: "/guilds/100000000000001010/users/100000000000001011/banners",
        storagePrefix: "guilds/100000000000001010/users/100000000000001011/banners",
    },
    { name: "icon root download", basePath: "/icons/100000000000001012", storagePrefix: "icons/100000000000001012" },
    { name: "role icon", basePath: "/role-icons/100000000000001013", storagePrefix: "role-icons/100000000000001013", storedName: (id) => `${id}.png` },
    { name: "splash", basePath: "/splashes/100000000000001014", storagePrefix: "splashes/100000000000001014" },
    { name: "team icon", basePath: "/team-icons/100000000000001015", storagePrefix: "team-icons/100000000000001015" },
];

const singleAssetFamilies: SingleAssetFamily[] = [
    { name: "emoji", basePath: "/emojis/100000000000001016", storagePath: "emojis/100000000000001016" },
    { name: "sticker", basePath: "/stickers/100000000000001017", deletePath: "/stickers/100000000000001017/", storagePath: "stickers/100000000000001017" },
];

test("CDN asset route families upload, download, cache, delete, and report missing objects over HTTP", { timeout: 60_000 }, async () => {
    assert.deepEqual(coveredManifestIds, [
        "cdn:http:DELETE:/app-assets/:guild_id/:id",
        "cdn:http:DELETE:/app-icons/:guild_id/:id",
        "cdn:http:DELETE:/avatars/:user_id/:id",
        "cdn:http:DELETE:/banners/:guild_id/:id",
        "cdn:http:DELETE:/channel-icons/:guild_id/:id",
        "cdn:http:DELETE:/discover-splashes/:guild_id/:id",
        "cdn:http:DELETE:/discovery-splashes/:guild_id/:id",
        "cdn:http:DELETE:/emojis/:emoji_id",
        "cdn:http:DELETE:/guild-profiles/:id",
        "cdn:http:DELETE:/guilds/:guild_id/users/:user_id/avatars/:id",
        "cdn:http:DELETE:/guilds/:guild_id/users/:user_id/banners/:id",
        "cdn:http:DELETE:/role-icons/:role_id/:id",
        "cdn:http:DELETE:/splashes/:guild_id/:id",
        "cdn:http:DELETE:/stickers/:sticker_id/",
        "cdn:http:DELETE:/team-icons/:guild_id/:id",
        "cdn:http:GET:/app-assets/:guild_id",
        "cdn:http:GET:/app-assets/:guild_id/:hash",
        "cdn:http:GET:/app-icons/:guild_id",
        "cdn:http:GET:/app-icons/:guild_id/:hash",
        "cdn:http:GET:/avatar-decoration-presets/:avatar_decoration_data_asset",
        "cdn:http:GET:/avatars/:user_id",
        "cdn:http:GET:/avatars/:user_id/:hash",
        "cdn:http:GET:/badge-icons/:badge_id",
        "cdn:http:GET:/banners/:guild_id",
        "cdn:http:GET:/banners/:guild_id/:hash",
        "cdn:http:GET:/channel-icons/:guild_id",
        "cdn:http:GET:/channel-icons/:guild_id/:hash",
        "cdn:http:GET:/discover-splashes/:guild_id",
        "cdn:http:GET:/discover-splashes/:guild_id/:hash",
        "cdn:http:GET:/discovery-splashes/:guild_id",
        "cdn:http:GET:/discovery-splashes/:guild_id/:hash",
        "cdn:http:GET:/embed/avatars/:id",
        "cdn:http:GET:/embed/group-avatars/:id",
        "cdn:http:GET:/emojis/:emoji_id",
        "cdn:http:GET:/guild-profiles/",
        "cdn:http:GET:/guild-profiles/:hash",
        "cdn:http:GET:/guilds/:guild_id/users/:user_id/avatars/",
        "cdn:http:GET:/guilds/:guild_id/users/:user_id/avatars/:hash",
        "cdn:http:GET:/guilds/:guild_id/users/:user_id/banners/",
        "cdn:http:GET:/guilds/:guild_id/users/:user_id/banners/:hash",
        "cdn:http:GET:/icons/:guild_id",
        "cdn:http:GET:/ping/",
        "cdn:http:GET:/role-icons/:role_id",
        "cdn:http:GET:/role-icons/:role_id/:hash",
        "cdn:http:GET:/splashes/:guild_id",
        "cdn:http:GET:/splashes/:guild_id/:hash",
        "cdn:http:GET:/stickers/:sticker_id",
        "cdn:http:GET:/team-icons/:guild_id",
        "cdn:http:GET:/team-icons/:guild_id/:hash",
        "cdn:http:POST:/app-assets/:guild_id",
        "cdn:http:POST:/app-icons/:guild_id",
        "cdn:http:POST:/avatars/:user_id",
        "cdn:http:POST:/banners/:guild_id",
        "cdn:http:POST:/channel-icons/:guild_id",
        "cdn:http:POST:/discover-splashes/:guild_id",
        "cdn:http:POST:/discovery-splashes/:guild_id",
        "cdn:http:POST:/emojis/:emoji_id",
        "cdn:http:POST:/guild-profiles/",
        "cdn:http:POST:/guilds/:guild_id/users/:user_id/avatars/",
        "cdn:http:POST:/guilds/:guild_id/users/:user_id/banners/",
        "cdn:http:POST:/role-icons/:role_id",
        "cdn:http:POST:/splashes/:guild_id",
        "cdn:http:POST:/stickers/:sticker_id",
        "cdn:http:POST:/team-icons/:guild_id",
    ]);

    await withCdnConfig(async () => {
        await withFileStorage(async ({ storage }) => {
            const cdn = await startCdn();

            try {
                for (const family of hashAssetFamilies) {
                    await coverHashAssetFamily(cdn, storage, family);
                }

                for (const family of singleAssetFamilies) {
                    await coverSingleAssetFamily(cdn, storage, family);
                }

                await coverStaticObjectRoutes(cdn, storage);
            } finally {
                await cdn.stop();
            }
        });
    });
});

async function coverHashAssetFamily(cdn: StartedCdn, storage: TestStorage, family: HashAssetFamily) {
    const uploadUrl = `${cdn.baseUrl}${family.basePath}`;
    const invalidUpload = await postMultipart(uploadUrl, Buffer.from(`not a ${family.name} image`), "invalid.txt", "text/plain");
    await assertStatus(invalidUpload, 400);
    assert.equal((await assertJsonObject(invalidUpload)).message, "Error: Invalid file type");

    const upload = await postMultipart(uploadUrl, png, `${family.name.replaceAll(" ", "-")}.png`, "image/png");
    await assertStatus(upload, 200);
    const uploadBody = await assertJsonObject(upload);
    const id = uploadBody.id as string;
    const storedName = family.storedName?.(id) ?? id;
    const storagePath = `${family.storagePrefix}/${storedName}`;

    assert.equal(id, pngHash);
    assert.equal(uploadBody.content_type, "image/png");
    assert.equal(uploadBody.size, png.length);
    assert.equal(uploadBody.url, `https://cdn.example${family.basePath}/${id}`);
    assert.equal(await storage.exists(storagePath), true);

    await assertAssetDownload(await fetch(uploadUrl), png);
    await assertAssetDownload(await fetch(`${uploadUrl}/${id}.png`), png);

    if (family.assertUnsignedDelete) {
        const unsignedDelete = await fetch(`${uploadUrl}/${id}`, { method: "DELETE" });
        await assertStatus(unsignedDelete, 400);
        assert.equal((await assertJsonObject(unsignedDelete)).message, "Error: Invalid request signature");
        assert.equal(await storage.exists(storagePath), true);
    }

    const deleted = await fetch(`${uploadUrl}/${id}`, { method: "DELETE", headers: { signature: requestSignature } });
    await assertStatus(deleted, 200);
    assert.deepEqual(await assertJsonObject(deleted), { success: true });
    assert.equal(await storage.exists(storagePath), false);

    const missing = await fetch(`${uploadUrl}/${id}.png`);
    await assertStatus(missing, 404);
}

async function coverSingleAssetFamily(cdn: StartedCdn, storage: TestStorage, family: SingleAssetFamily) {
    const uploadUrl = `${cdn.baseUrl}${family.basePath}`;
    const invalidUpload = await postMultipart(uploadUrl, Buffer.from(`not a ${family.name} image`), "invalid.txt", "text/plain");
    await assertStatus(invalidUpload, 400);
    assert.equal((await assertJsonObject(invalidUpload)).message, "Error: Invalid file type");

    const upload = await postMultipart(uploadUrl, png, `${family.name}.png`, "image/png");
    await assertStatus(upload, 200);
    const uploadBody = await assertJsonObject(upload);

    assert.equal(uploadBody.id, pngHash);
    assert.equal(uploadBody.content_type, "image/png");
    assert.equal(uploadBody.size, png.length);
    assert.equal(uploadBody.url, `https://cdn.example${family.basePath}`);
    assert.equal(await storage.exists(family.storagePath), true);

    await assertAssetDownload(await fetch(`${uploadUrl}.png`), png);

    const deleted = await fetch(`${cdn.baseUrl}${family.deletePath ?? family.basePath}`, { method: "DELETE", headers: { signature: requestSignature } });
    await assertStatus(deleted, 200);
    assert.deepEqual(await assertJsonObject(deleted), { success: true });
    assert.equal(await storage.exists(family.storagePath), false);

    const missing = await fetch(`${uploadUrl}.png`);
    await assertStatus(missing, 404);
}

async function coverStaticObjectRoutes(cdn: StartedCdn, storage: FileStorage) {
    await createCdnObject(storage, "avatar-decoration-presets/scenario-decoration", png);
    await createCdnObject(storage, "badge-icons/scenario-badge", png);

    await assertAssetDownload(await fetch(`${cdn.baseUrl}/avatar-decoration-presets/scenario-decoration`), png);
    await assertAssetDownload(await fetch(`${cdn.baseUrl}/badge-icons/scenario-badge`), png);
    await assertStatus(await fetch(`${cdn.baseUrl}/badge-icons/missing-badge`), 404);

    await assertAssetDownload(await fetch(`${cdn.baseUrl}/embed/avatars/0.png`));
    await assertAssetDownload(await fetch(`${cdn.baseUrl}/embed/group-avatars/0.png`));

    const ping = await fetch(`${cdn.baseUrl}/ping/`);
    await assertStatus(ping, 200);
    assert.equal(await ping.text(), "pong");
}

async function assertAssetDownload(response: Response, expected?: Buffer) {
    await assertStatus(response, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("cache-control"), cacheHeader);

    const body = Buffer.from(await response.arrayBuffer());
    if (expected) assert.deepEqual(body, expected);
    else assert.equal(body.subarray(1, 4).toString("ascii"), "PNG");
}

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
    const directory = await mkdtemp(path.join(tmpdir(), "spacebar-cdn-assets-config-"));
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
                cdn: { endpointPublic: "https://cdn.example", endpointPrivate: "http://127.0.0.1:3003" },
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

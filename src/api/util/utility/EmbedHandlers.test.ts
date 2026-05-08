import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test, type TestContext } from "node:test";
import type { Embed } from "@spacebar/schemas";
import type { Message } from "../../../util/index.js";
import { mergeGeneratedUrlEmbeds } from "./EmbedMerge";

type UtilModule = typeof import("../../../util/index.js");

process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
delete process.env.EVENT_TRANSMISSION;

const richEmbedType = "rich" as Embed["type"];
const linkEmbedType = "link" as Embed["type"];
const imagorServerUrl = "https://imagor.example.com";
const imagorSecret = "test-secret";

async function loadEmbedModules() {
    const util = require("@spacebar/util") as UtilModule;
    const handlers = await import("./EmbedHandlers.js");

    return {
        util,
        Config: util.Config,
        EmbedCache: util.EmbedCache,
        EmbedHandlers: handlers.EmbedHandlers,
        Message: util.Message,
        fillMessageUrlEmbeds: handlers.fillMessageUrlEmbeds,
        getProxyUrl: handlers.getProxyUrl,
    };
}

async function createLocalPixivFixture(t: TestContext, options: { failImageProbe?: boolean } = {}) {
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
    const server = createServer((req, res) => {
        const requestUrl = new URL(req.url ?? "/", "http://fixture.local");

        if (requestUrl.pathname === "/preview.png") {
            if (options.failImageProbe) {
                res.writeHead(403, { "content-type": "text/plain" });
                res.end("Image probe denied");
                return;
            }

            if (req.headers.referer !== `http://${req.headers.host}/`) {
                res.writeHead(403, { "content-type": "text/plain" });
                res.end("Pixiv-style image requests must include the artwork page as referer");
                return;
            }

            res.writeHead(200, {
                "content-type": "image/png",
                "content-length": image.length,
            });
            res.end(image);
            return;
        }

        res.writeHead(200, { "content-type": "text/html" });
        res.end(`<!doctype html>
            <html>
                <head>
                    <meta property="og:title" content="Pixiv sample">
                    <meta property="og:description" content="Artwork preview">
                    <meta property="og:image" content="/preview.png?illust_id=123&amp;mdate=456">
                </head>
            </html>`);
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    t.after(() => server.close());

    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
}

function imagorSignature(path: string) {
    return crypto.createHmac("sha1", imagorSecret).update(path).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

function signedImagorUrl(path: string) {
    return `${imagorServerUrl}/${imagorSignature(path)}/${path}`;
}

function b64SourceUrl(url: string) {
    return `b64:${Buffer.from(url).toString("base64url")}`;
}

function createMessage(content: string, embeds: Embed[]) {
    const message = {
        id: "message-id",
        channel_id: "channel-id",
        content,
        embeds,
        toJSON() {
            return {
                id: this.id,
                channel_id: this.channel_id,
                content: this.content,
                embeds: this.embeds,
            };
        },
    };

    return message as Message;
}

function mockEmbedConfig(t: TestContext, Config: UtilModule["Config"], maxLinkEmbeds: number, maxEmbeds: number) {
    const config = Config.get();
    config.embeds.maxLinkEmbeds = maxLinkEmbeds;
    config.limits.message.maxEmbeds = maxEmbeds;
    config.cdn.endpointPublic = "https://cdn.example.com";

    t.mock.method(Config, "get", () => config);
}

function captureMessageEvents(t: TestContext, util: UtilModule) {
    const emittedEvents: unknown[] = [];
    const listener = (event: unknown) => emittedEvents.push(event);
    util.events.on("channel-id", listener);
    t.after(() => util.events.off("channel-id", listener));

    return emittedEvents;
}

function rejectUnexpectedPersistence(t: TestContext, Message: UtilModule["Message"], EmbedCache: UtilModule["EmbedCache"]) {
    t.mock.method(Message, "update", async () => {
        throw new Error("Message.update should not be called");
    });
    t.mock.method(EmbedCache, "find", async () => {
        throw new Error("EmbedCache.find should not be called");
    });
}

describe("mergeGeneratedUrlEmbeds", () => {
    test("does not report a change when no embeds are generated", () => {
        const result = mergeGeneratedUrlEmbeds([], [], 10);

        assert.equal(result.changed, false);
        assert.deepEqual(result.embeds, []);
    });

    test("reports a change only when generated URL embeds are added", () => {
        const generatedEmbed = {
            type: "rich",
            url: "https://example.com",
            title: "Example",
        } as Embed;

        const result = mergeGeneratedUrlEmbeds([], [generatedEmbed], 10);

        assert.equal(result.changed, true);
        assert.deepEqual(result.embeds, [generatedEmbed]);
    });

    test("does not duplicate a previously generated rich URL embed", () => {
        const generatedEmbed = {
            type: "rich",
            url: "https://example.com",
            title: "Example",
        } as Embed;

        const result = mergeGeneratedUrlEmbeds([generatedEmbed], [generatedEmbed], 10);

        assert.equal(result.changed, false);
        assert.deepEqual(result.embeds, [generatedEmbed]);
    });

    test("honors the max embed limit without emitting a no-op change", () => {
        const existingEmbed = {
            type: "rich",
            title: "Existing",
        } as Embed;
        const generatedEmbed = {
            type: "rich",
            title: "Generated",
        } as Embed;

        const result = mergeGeneratedUrlEmbeds([existingEmbed], [generatedEmbed], 1);

        assert.equal(result.changed, false);
        assert.deepEqual(result.embeds, [existingEmbed]);
    });
});

describe("getProxyUrl", () => {
    test("generates signed Imagor URLs for proxied embed images", async (t) => {
        const { Config, getProxyUrl } = await loadEmbedModules();
        const config = Config.get();
        config.cdn.imagorServerUrl = imagorServerUrl;
        config.cdn.resizeWidthMax = 1000;
        config.cdn.resizeHeightMax = 1000;
        config.security.requestSignature = imagorSecret;
        t.mock.method(Config, "get", () => config);

        const path = "600x800/i.pximg.net/img-original/img/2026/05/08/00/00/00/123456789_p0.png";

        assert.equal(getProxyUrl(new URL("https://i.pximg.net/img-original/img/2026/05/08/00/00/00/123456789_p0.png"), 600, 800), signedImagorUrl(path));
    });

    test("encodes query-bearing source URLs before signing Imagor proxy paths", async (t) => {
        const { Config, getProxyUrl } = await loadEmbedModules();
        const config = Config.get();
        config.cdn.imagorServerUrl = imagorServerUrl;
        config.cdn.resizeWidthMax = 1200;
        config.cdn.resizeHeightMax = 630;
        config.security.requestSignature = imagorSecret;
        t.mock.method(Config, "get", () => config);

        const source = "https://embed.pixiv.net/artwork.php?illust_id=123&mdate=456";
        const path = `1200x630/${b64SourceUrl(source)}`;

        assert.equal(getProxyUrl(new URL(source), 1200, 630), signedImagorUrl(path));
    });
});

describe("Pixiv embeds", () => {
    test("probes image dimensions when Pixiv metadata omits them", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        const fixtureOrigin = await createLocalPixivFixture(t);
        const config = Config.get();
        config.cdn.imagorServerUrl = imagorServerUrl;
        config.cdn.resizeWidthMax = 1000;
        config.cdn.resizeHeightMax = 1000;
        config.security.requestSignature = imagorSecret;
        t.mock.method(Config, "get", () => config);

        const embed = await EmbedHandlers["www.pixiv.net"](new URL(`${fixtureOrigin}/artworks/123`));
        const imageUrl = `${fixtureOrigin}/preview.png?illust_id=123&mdate=456`;
        const proxyPath = `1x1/${b64SourceUrl(imageUrl)}`;

        assert.deepEqual(embed, {
            url: `${fixtureOrigin}/artworks/123`,
            type: "image",
            title: "Pixiv sample",
            description: "Artwork preview",
            image: {
                url: imageUrl,
                width: 1,
                height: 1,
                proxy_url: signedImagorUrl(proxyPath),
            },
            provider: {
                url: "https://pixiv.net",
                name: "Pixiv",
            },
        });
    });

    test("returns null when Pixiv image dimensions cannot be probed", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        const fixtureOrigin = await createLocalPixivFixture(t, { failImageProbe: true });
        const config = Config.get();
        config.cdn.imagorServerUrl = imagorServerUrl;
        config.cdn.resizeWidthMax = 1000;
        config.cdn.resizeHeightMax = 1000;
        config.security.requestSignature = imagorSecret;
        t.mock.method(Config, "get", () => config);

        assert.equal(await EmbedHandlers["www.pixiv.net"](new URL(`${fixtureOrigin}/artworks/123`)), null);
    });
});

describe("fillMessageUrlEmbeds", () => {
    test("does not write or read embed cache when there are no eligible links and no stale automatic embeds", async (t) => {
        const { Config, EmbedCache, Message, fillMessageUrlEmbeds, util } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        rejectUnexpectedPersistence(t, Message, EmbedCache);
        const emittedEvents = captureMessageEvents(t, util);

        const richEmbed = { type: richEmbedType, title: "explicit" };
        const message = createMessage("plain message", [richEmbed]);

        await fillMessageUrlEmbeds(message);

        assert.deepEqual(message.embeds, [richEmbed]);
        assert.equal(emittedEvents.length, 0);
    });

    test("does not write or read embed cache when automatic link embeds are disabled and no stale automatic embeds exist", async (t) => {
        const { Config, EmbedCache, Message, fillMessageUrlEmbeds, util } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 0, 10);
        rejectUnexpectedPersistence(t, Message, EmbedCache);
        const emittedEvents = captureMessageEvents(t, util);

        const richEmbed = { type: richEmbedType, title: "explicit" };
        const message = createMessage("https://example.com", [richEmbed]);

        await fillMessageUrlEmbeds(message);

        assert.deepEqual(message.embeds, [richEmbed]);
        assert.equal(emittedEvents.length, 0);
    });

    test("clears stale automatic embeds with one update when no new link embeds are selected", async (t) => {
        const { Config, EmbedCache, Message, fillMessageUrlEmbeds, util } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 0, 10);
        t.mock.method(EmbedCache, "find", async () => {
            throw new Error("EmbedCache.find should not be called");
        });

        const persistedEmbeds: unknown[] = [];
        const emittedEvents = captureMessageEvents(t, util);
        t.mock.method(Message, "update", async (_criteria: unknown, update: unknown) => {
            persistedEmbeds.push(update);
        });

        const richEmbed = { type: richEmbedType, title: "explicit" };
        const automaticEmbed = { type: linkEmbedType, url: "https://example.com" };
        const message = createMessage("https://example.com", [richEmbed, automaticEmbed]);

        await fillMessageUrlEmbeds(message);

        assert.deepEqual(message.embeds, [richEmbed]);
        assert.equal(persistedEmbeds.length, 1);
        assert.deepEqual(persistedEmbeds[0], { embeds: [richEmbed] });
        assert.equal(emittedEvents.length, 1);
    });

    test("does not read embed cache or write when explicit rich embeds already fill message embed capacity", async (t) => {
        const { Config, EmbedCache, Message, fillMessageUrlEmbeds, util } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 1);
        rejectUnexpectedPersistence(t, Message, EmbedCache);
        const emittedEvents = captureMessageEvents(t, util);

        const richEmbed = { type: richEmbedType, title: "explicit" };
        const message = createMessage("https://example.com", [richEmbed]);

        await fillMessageUrlEmbeds(message);

        assert.deepEqual(message.embeds, [richEmbed]);
        assert.equal(emittedEvents.length, 0);
    });
});

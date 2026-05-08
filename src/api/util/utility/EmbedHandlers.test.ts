import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import type { Embed } from "@spacebar/schemas";
import type { Message } from "../../../util/index.js";
import { mergeGeneratedUrlEmbeds } from "./EmbedMerge";

type UtilModule = typeof import("../../../util/index.js");

process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
delete process.env.EVENT_TRANSMISSION;

const richEmbedType = "rich" as Embed["type"];
const linkEmbedType = "link" as Embed["type"];

async function loadEmbedModules() {
    const util = await import("../../../util/index.js");
    const handlers = await import("./EmbedHandlers.js");

    return {
        util,
        Config: util.Config,
        EmbedCache: util.EmbedCache,
        Message: util.Message,
        EmbedHandlers: handlers.EmbedHandlers,
        fillMessageUrlEmbeds: handlers.fillMessageUrlEmbeds,
    };
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

describe("EmbedHandlers.default", () => {
    test("creates a video embed from generic OpenGraph video metadata", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);

        const fetches: { url: string; method: string | undefined }[] = [];
        t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
            const requestUrl = input instanceof Request ? input.url : input.toString();
            fetches.push({ url: requestUrl, method: init?.method });

            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-type": "text/html" },
                });
            }

            return new Response(
                `<!doctype html>
                <html>
                    <head>
                        <meta property="og:type" content="video.other">
                        <meta property="og:title" content="Generic Video">
                        <meta property="og:description" content="A generic video page">
                        <meta property="og:site_name" content="Example Videos">
                        <meta property="og:image" content="https://media.example.test/poster.jpg">
                        <meta property="og:image:width" content="640">
                        <meta property="og:image:height" content="360">
                        <meta property="og:video" content="/player/video.mp4">
                        <meta property="og:video:width" content="1280">
                        <meta property="og:video:height" content="720">
                    </head>
                </html>`,
                { headers: { "content-type": "text/html" } },
            );
        });

        const embed = await EmbedHandlers.default(new URL("https://example.test/watch/1"));

        assert.deepEqual(fetches, [
            { url: "https://example.test/watch/1", method: "HEAD" },
            { url: "https://example.test/watch/1", method: "GET" },
        ]);
        assert.deepEqual(embed, {
            url: "https://example.test/watch/1",
            type: "video",
            title: "Generic Video",
            video: {
                url: "https://example.test/player/video.mp4",
                width: 1280,
                height: 720,
                proxy_url: "https://example.test/player/video.mp4",
            },
            thumbnail: {
                url: "https://media.example.test/poster.jpg",
                width: 640,
                height: 360,
                proxy_url: "https://media.example.test/poster.jpg",
            },
            description: "A generic video page",
            provider: {
                name: "Example Videos",
                url: "https://example.test",
            },
        });
    });

    test("keeps a generic page as a link embed when video dimensions are missing", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);

        t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-type": "text/html" },
                });
            }

            return new Response(
                `<!doctype html>
                <html>
                    <head>
                        <meta property="og:title" content="Video Without Dimensions">
                        <meta property="og:description" content="The page still has link metadata">
                        <meta property="og:video" content="https://media.example.test/video.mp4">
                    </head>
                </html>`,
                { headers: { "content-type": "text/html" } },
            );
        });

        const embed = await EmbedHandlers.default(new URL("https://example.test/watch/2"));

        assert.deepEqual(embed, {
            url: "https://example.test/watch/2",
            type: "link",
            title: "Video Without Dimensions",
            video: undefined,
            thumbnail: undefined,
            description: "The page still has link metadata",
            provider: undefined,
        });
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

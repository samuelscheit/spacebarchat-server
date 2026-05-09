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
        EmbedHandlers: handlers.EmbedHandlers,
        Message: util.Message,
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

async function captureYoutubeRequestHeaders(
    t: TestContext,
    Config: UtilModule["Config"],
    EmbedHandlers: (typeof import("./EmbedHandlers.js"))["EmbedHandlers"],
    youtubeConfig: Partial<ReturnType<typeof Config.get>["embeds"]["youtube"]>,
) {
    const config = Config.get();
    config.embeds.youtube.cookie = null;
    config.embeds.youtube.useCurlUserAgent = false;
    config.embeds.youtube.userAgent = null;
    Object.assign(config.embeds.youtube, youtubeConfig);
    t.mock.method(Config, "get", () => config);

    const fetchCalls: { url: URL; init?: RequestInit }[] = [];
    t.mock.method(globalThis, "fetch", async (url: URL, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        return new Response(`<html><head><meta property="og:title" content="Video"></head></html>`);
    });

    await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=test"));

    assert.equal(fetchCalls.length, 1);
    return fetchCalls[0].init?.headers;
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

describe("YouTube embed request headers", () => {
    test("uses the default consent cookie without a YouTube user-agent override", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();

        const headers = await captureYoutubeRequestHeaders(t, Config, EmbedHandlers, {});

        assert.deepEqual(headers, {
            "user-agent": "Mozilla/5.0 (compatible; Spacebar/1.0; +https://github.com/spacebarchat/server)",
            "accept-language": "en-US,en;q=0.9",
            cookie: "CONSENT=PENDING+999; hl=en",
        });
    });

    test("uses the legacy curl user-agent only when the YouTube curl option is enabled", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();

        const headers = await captureYoutubeRequestHeaders(t, Config, EmbedHandlers, { useCurlUserAgent: true });

        assert.deepEqual(headers, {
            "user-agent": "curl/8.18.0",
            "accept-language": "en-US,en;q=0.9",
            cookie: "CONSENT=PENDING+999; hl=en",
        });
    });

    test("lets explicit YouTube user-agent config override the legacy curl option", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();

        const headers = await captureYoutubeRequestHeaders(t, Config, EmbedHandlers, {
            cookie: "CONSENT=YES; hl=en",
            useCurlUserAgent: true,
            userAgent: "custom-youtube-agent",
        });

        assert.deepEqual(headers, {
            "user-agent": "custom-youtube-agent",
            "accept-language": "en-US,en;q=0.9",
            cookie: "CONSENT=YES; hl=en",
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

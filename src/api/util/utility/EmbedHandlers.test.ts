import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import type { Embed } from "@spacebar/schemas";
import type { Message } from "@spacebar/util";
import { mergeGeneratedUrlEmbeds } from "./EmbedMerge";

type UtilModule = typeof import("@spacebar/util");

process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
delete process.env.EVENT_TRANSMISSION;

const richEmbedType = "rich" as Embed["type"];
const linkEmbedType = "link" as Embed["type"];

async function loadEmbedModules() {
    const util = require("@spacebar/util") as UtilModule;
    const handlers = await import("./EmbedHandlers.js");

    return {
        util,
        Config: util.Config,
        EmbedHandlers: handlers.EmbedHandlers,
        EmbedCache: util.EmbedCache,
        Message: util.Message,
        fillMessageUrlEmbeds: handlers.fillMessageUrlEmbeds,
        getOrUpdateEmbedCache: handlers.getOrUpdateEmbedCache,
        normalizeUrl: util.normalizeUrl,
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

function mockEmbedCacheCleanup(t: TestContext, EmbedCache: UtilModule["EmbedCache"]) {
    t.mock.method(EmbedCache, "delete", async () => ({ affected: 0, raw: [] }));
}

function mockExampleEmbedHandler(
    t: TestContext,
    EmbedHandlers: Awaited<ReturnType<typeof loadEmbedModules>>["EmbedHandlers"],
    handler: Awaited<ReturnType<typeof loadEmbedModules>>["EmbedHandlers"][string],
) {
    const hadExampleHandler = Object.hasOwn(EmbedHandlers, "example.com");
    const originalExampleHandler = EmbedHandlers["example.com"];
    EmbedHandlers["example.com"] = handler;

    t.after(() => {
        if (hadExampleHandler) {
            EmbedHandlers["example.com"] = originalExampleHandler;
        } else {
            delete EmbedHandlers["example.com"];
        }
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

describe("getOrUpdateEmbedCache", () => {
    test("reuses cached embed rows instead of regenerating the same normalized link", async (t) => {
        const { Config, EmbedCache, EmbedHandlers, getOrUpdateEmbedCache } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        mockEmbedCacheCleanup(t, EmbedCache);

        const cachedEmbed = {
            type: linkEmbedType,
            url: "https://example.com/article",
            title: "Cached title",
        } as Embed;
        const cachedEntry = {
            id: "cached-entry",
            url: "https://example.com/article",
            embeds: [cachedEmbed],
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };

        t.mock.method(EmbedCache, "find", async () => [cachedEntry]);
        t.mock.method(EmbedCache, "create", () => {
            throw new Error("EmbedCache.create should not be called for cached links");
        });
        mockExampleEmbedHandler(t, EmbedHandlers, async () => {
            throw new Error("embed handler should not run for cached links");
        });

        const entries = await getOrUpdateEmbedCache(["https://example.com/article#ignored"]);

        assert.deepEqual(entries, [cachedEntry]);
    });

    test("persists newly generated link embeds in EmbedCache using the normalized URL", async (t) => {
        const { Config, EmbedCache, EmbedHandlers, getOrUpdateEmbedCache, normalizeUrl } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        mockEmbedCacheCleanup(t, EmbedCache);

        const generatedEmbed = {
            type: linkEmbedType,
            url: "https://example.com/article/?b=2&a=1#fragment",
            title: "Generated title",
        } as Embed;
        const savedEntries: unknown[] = [];

        t.mock.method(EmbedCache, "find", async () => []);
        t.mock.method(EmbedCache, "create", (entry: unknown) => ({
            ...(entry as Record<string, unknown>),
            id: "generated-entry",
            save: async () => {
                savedEntries.push(entry);
                return {
                    ...(entry as Record<string, unknown>),
                    id: "generated-entry",
                };
            },
        }));
        mockExampleEmbedHandler(t, EmbedHandlers, async () => generatedEmbed);

        const sourceUrl = "https://example.com/article/?b=2&a=1#fragment";
        const entries = await getOrUpdateEmbedCache([sourceUrl]);

        assert.equal(savedEntries.length, 1);
        const savedEntry = savedEntries[0] as {
            url: string;
            embeds: Embed[];
            createdAt: Date;
        };
        assert.equal(savedEntry.url, normalizeUrl(sourceUrl));
        assert.deepEqual(savedEntry.embeds, [generatedEmbed]);
        assert.ok(savedEntry.createdAt instanceof Date);
        assert.equal(entries.length, 1);
        assert.equal(entries[0].url, savedEntry.url);
        assert.deepEqual(entries[0].embeds, [generatedEmbed]);
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

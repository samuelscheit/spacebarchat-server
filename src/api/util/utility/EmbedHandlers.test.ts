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

    test("keeps multiple generated embeds from one URL when capacity allows", () => {
        const firstGeneratedEmbed = {
            type: "rich",
            url: "https://twitter.com/spacebar/status/123",
            title: "Tweet",
        } as Embed;
        const secondGeneratedEmbed = {
            type: "rich",
            url: "https://twitter.com/spacebar/status/123",
            image: { url: "https://pbs.twimg.com/media/photo-2.jpg" },
        } as Embed;

        const result = mergeGeneratedUrlEmbeds([], [firstGeneratedEmbed, secondGeneratedEmbed], 10);

        assert.equal(result.changed, true);
        assert.deepEqual(result.embeds, [firstGeneratedEmbed, secondGeneratedEmbed]);
    });
});

describe("EmbedHandlers.twitter.com", () => {
    test("returns additional rich embeds for tweet photos beyond the first", async (t) => {
        const { Config } = await loadEmbedModules();
        const { EmbedHandlers } = await import("./EmbedHandlers.js");
        const config = Config.get();
        config.external.twitter = "test-twitter-token";
        config.cdn.imagorServerUrl = null;

        t.mock.method(Config, "get", () => config);
        t.mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) => {
            assert.equal(
                url.toString(),
                "https://api.twitter.com/2/tweets/1234567890?expansions=author_id,attachments.media_keys&media.fields=url,width,height&tweet.fields=created_at,public_metrics&user.fields=profile_image_url",
            );
            assert.deepEqual(init?.headers, { authorization: "Bearer test-twitter-token" });

            return new Response(
                JSON.stringify({
                    includes: {
                        users: [
                            {
                                profile_image_url: "https://pbs.twimg.com/profile_images/avatar.jpg",
                                username: "spacebar",
                                name: "Spacebar",
                            },
                        ],
                        media: [
                            {
                                type: "photo",
                                width: 1200,
                                height: 900,
                                url: "https://pbs.twimg.com/media/photo-1.jpg",
                            },
                            {
                                type: "photo",
                                width: 800,
                                height: 600,
                                url: "https://pbs.twimg.com/media/photo-2.jpg",
                            },
                        ],
                    },
                    data: {
                        text: "Tweet text",
                        created_at: "2026-05-08T12:00:00.000Z",
                        public_metrics: {
                            like_count: 10,
                            retweet_count: 2,
                        },
                    },
                }),
                { headers: { "content-type": "application/json" } },
            );
        });

        const result = await EmbedHandlers["twitter.com"](new URL("https://twitter.com/spacebar/status/1234567890"));

        assert.ok(Array.isArray(result));
        assert.equal(result.length, 2);
        assert.equal(result[0].image?.url, "https://pbs.twimg.com/media/photo-1.jpg");
        assert.equal(result[1].type, "rich");
        assert.equal(result[1].url, "https://twitter.com/spacebar/status/1234567890");
        assert.equal(result[1].image?.url, "https://pbs.twimg.com/media/photo-2.jpg");
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

    test("adds every generated embed from a cached URL entry", async (t) => {
        const { Config, EmbedCache, Message, fillMessageUrlEmbeds, util } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        const firstGeneratedEmbed = {
            type: linkEmbedType,
            url: "https://twitter.com/spacebar/status/123",
            title: "Tweet",
        };
        const secondGeneratedEmbed = {
            type: linkEmbedType,
            url: "https://twitter.com/spacebar/status/123",
            image: { url: "https://pbs.twimg.com/media/photo-2.jpg" },
        };

        t.mock.method(EmbedCache, "find", async () => [
            {
                id: "cache-id",
                url: "https://twitter.com/spacebar/status/123",
                embeds: [firstGeneratedEmbed, secondGeneratedEmbed],
                createdAt: new Date("2026-05-08T12:00:00.000Z"),
            },
        ]);
        t.mock.method(EmbedCache, "delete", async () => ({ affected: 0, raw: [] }));

        const persistedEmbeds: unknown[] = [];
        const emittedEvents = captureMessageEvents(t, util);
        t.mock.method(Message, "update", async (_criteria: unknown, update: unknown) => {
            persistedEmbeds.push(update);
        });

        const message = createMessage("https://twitter.com/spacebar/status/123", []);

        await fillMessageUrlEmbeds(message);

        assert.deepEqual(message.embeds, [firstGeneratedEmbed, secondGeneratedEmbed]);
        assert.equal(persistedEmbeds.length, 1);
        assert.deepEqual(persistedEmbeds[0], { embeds: [firstGeneratedEmbed, secondGeneratedEmbed] });
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

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
        getTwitterStatusId: handlers.getTwitterStatusId,
    };
}

function mockTwitterConfig(t: TestContext, Config: UtilModule["Config"]) {
    const config = Config.get();
    config.external.twitter = "twitter-token";
    config.cdn.endpointPublic = "https://cdn.example.com";
    config.cdn.imagorServerUrl = null;

    t.mock.method(Config, "get", () => config);
}

function mockTwitterApiFetch(t: TestContext) {
    const requestedUrls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        requestedUrls.push(input.toString());
        return {
            json: async () => ({
                includes: {
                    users: [
                        {
                            profile_image_url: "https://pbs.twimg.com/profile_images/example.jpg",
                            username: "spacebar",
                            name: "Spacebar",
                        },
                    ],
                    media: [
                        {
                            type: "photo",
                            width: 1024,
                            height: 512,
                            url: "https://pbs.twimg.com/media/example.jpg",
                        },
                    ],
                },
                data: {
                    text: "hello from twitter",
                    created_at: "2026-05-08T10:00:00.000Z",
                    public_metrics: { like_count: 12, retweet_count: 3 },
                },
            }),
        } as Response;
    });

    return requestedUrls;
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

describe("Twitter embed handler", () => {
    test("extracts status ids from supported Twitter and X URL shapes", async () => {
        const { getTwitterStatusId } = await loadEmbedModules();

        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar/status/1234567890")), "1234567890");
        assert.equal(getTwitterStatusId(new URL("https://mobile.twitter.com/spacebar/statuses/1234567890?s=20")), "1234567890");
        assert.equal(getTwitterStatusId(new URL("https://x.com/spacebar/status/1234567890/photo/1")), "1234567890");
        assert.equal(getTwitterStatusId(new URL("https://twitter.com/i/web/status/1234567890")), "1234567890");
    });

    test("rejects non-status and malformed Twitter URLs before fetching", async (t) => {
        const { Config, EmbedHandlers, getTwitterStatusId } = await loadEmbedModules();
        mockTwitterConfig(t, Config);
        t.mock.method(globalThis, "fetch", async () => {
            throw new Error("fetch should not be called for non-status Twitter URLs");
        });

        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar")), undefined);
        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar/status/not-a-number")), undefined);
        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar/status/123abc")), undefined);
        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar/status/")), undefined);
        assert.equal(getTwitterStatusId(new URL("https://twitter.com/spacebar/other/1234567890?next=/status/999")), undefined);

        assert.equal(await EmbedHandlers["www.twitter.com"](new URL("https://twitter.com/spacebar")), null);
        assert.equal(await EmbedHandlers["www.twitter.com"](new URL("https://twitter.com/spacebar/status/not-a-number")), null);
    });

    test("uses parsed status id when fetching Twitter API embeds", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockTwitterConfig(t, Config);
        const requestedUrls = mockTwitterApiFetch(t);

        const embed = await EmbedHandlers["x.com"](new URL("https://x.com/spacebar/status/1234567890/photo/1?lang=en"));
        assert.ok(embed && !Array.isArray(embed));

        assert.equal(requestedUrls.length, 1);
        assert.match(requestedUrls[0], /^https:\/\/api\.twitter\.com\/2\/tweets\/1234567890\?/);
        assert.equal(embed?.url, "https://x.com/spacebar/status/1234567890/photo/1");
        assert.equal(embed?.description, "hello from twitter");
        assert.equal(embed?.author?.name, "Spacebar (@spacebar)");
        assert.equal(embed?.image?.url, "https://pbs.twimg.com/media/example.jpg");
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

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

function mockYoutubeConfig(t: TestContext, Config: UtilModule["Config"]) {
    const config = Config.get();
    config.embeds.youtube.cookie = null;
    config.embeds.youtube.useCurlUserAgent = false;
    config.embeds.youtube.userAgent = null;
    t.mock.method(Config, "get", () => config);
}

function mockFetchHtml(t: TestContext, html: string) {
    t.mock.method(
        globalThis,
        "fetch",
        async () =>
            ({
                headers: {
                    get: () => null,
                },
                text: async () => html,
            }) as unknown as Response,
    );
}

const youtubeHtml = (authorMarkup: string) => `
    <html>
        <head>
            <meta property="og:title" content="Example video">
            <meta property="article:author" content="Example Channel">
            <meta property="og:description" content="Example description">
            <meta property="og:image" content="https://i.ytimg.com/vi/example/maxresdefault.jpg">
            <meta property="og:image:width" content="1280">
            <meta property="og:image:height" content="720">
            <meta property="og:video:secure_url" content="https://www.youtube.com/embed/example">
            ${authorMarkup}
        </head>
    </html>
`;

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

describe("EmbedHandlers YouTube", () => {
    test("uses the video page JSON-LD owner profile URL when present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":"VideoObject","ownerProfileUrl":"http://www.youtube.com/@JsonLdChannel","externalChannelId":"UCjsonLdChannelId"}
                </script>
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="https://www.youtube.com/@MicrodataChannel">
                </span>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "http://www.youtube.com/@JsonLdChannel");
    });

    test("falls back to the video page JSON-LD external channel ID", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":"VideoObject","externalChannelId":"UCjsonLdChannelId"}
                </script>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "https://www.youtube.com/channel/UCjsonLdChannelId");
    });

    test("uses the video page author channel URL when present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="http://www.youtube.com/@ExampleChannel">
                </span>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "http://www.youtube.com/@ExampleChannel");
    });

    test("falls back to the channelId metadata when no author URL is present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(t, youtubeHtml(`<meta itemprop="channelId" content="UCexampleChannelId">`));

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "https://www.youtube.com/channel/UCexampleChannelId");
    });

    test("ignores malformed JSON-LD and omits author URL when no reliable channel metadata exists", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">{not json</script>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, undefined);
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

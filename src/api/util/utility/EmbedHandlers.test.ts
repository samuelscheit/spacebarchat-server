import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import type { Embed } from "@spacebar/schemas";
import type { Message } from "@spacebar/util";
import { mergeGeneratedUrlEmbeds } from "./EmbedMerge";

type UtilModule = typeof import("@spacebar/util");
type EmbedHandlersModule = typeof import("./EmbedHandlers.js");

process.env.DATABASE ??= "postgres://test:test@localhost:5432/test";
delete process.env.EVENT_TRANSMISSION;

const richEmbedType = "rich" as Embed["type"];
const linkEmbedType = "link" as Embed["type"];

function runtimeModuleExtension() {
    return __filename.endsWith(".ts") ? ".ts" : ".js";
}

function loadRuntimeModule<T>(path: string): T {
    return require(path) as T;
}

async function loadEmbedModules() {
    const extension = runtimeModuleExtension();
    const util = loadRuntimeModule<UtilModule>("@spacebar/util");
    const handlers = loadRuntimeModule<EmbedHandlersModule>(`./EmbedHandlers${extension}`);

    return {
        util,
        Config: util.Config,
        EmbedCache: util.EmbedCache,
        Message: util.Message,
        EmbedHandlers: handlers.EmbedHandlers,
        fillMessageUrlEmbeds: handlers.fillMessageUrlEmbeds,
        getTwitterStatusId: handlers.getTwitterStatusId,
        getOrUpdateEmbedCache: handlers.getOrUpdateEmbedCache,
        normalizeUrl: util.normalizeUrl,
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

async function captureYoutubeRequestHeaders(
    t: TestContext,
    Config: UtilModule["Config"],
    EmbedHandlers: EmbedHandlersModule["EmbedHandlers"],
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

function mockYoutubeConfig(t: TestContext, Config: UtilModule["Config"]) {
    const config = Config.get();
    config.embeds.youtube.cookie = null;
    config.embeds.youtube.useCurlUserAgent = false;
    config.embeds.youtube.userAgent = null;
    t.mock.method(Config, "get", () => config);
}

function mockFetchHtml(t: TestContext, html: string, responseUrl?: string) {
    t.mock.method(
        globalThis,
        "fetch",
        async () =>
            ({
                url: responseUrl,
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

const jsonLdChannelId = "UC1234567890123456789012";
const fallbackChannelId = "UCabcdefghijklmnopqrstuv";

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
        assert.equal(await EmbedHandlers["www.twitter.com"](new URL("https://twitter.com/spacebar/other/1234567890?next=/status/999")), null);
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

    test("routes Twitter and X host aliases through status parsing", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockTwitterConfig(t, Config);
        const requestedUrls = mockTwitterApiFetch(t);

        await EmbedHandlers["mobile.twitter.com"](new URL("https://mobile.twitter.com/spacebar/statuses/1111111111"));
        await EmbedHandlers["www.x.com"](new URL("https://www.x.com/spacebar/status/2222222222"));

        assert.equal(requestedUrls.length, 2);
        assert.match(requestedUrls[0], /^https:\/\/api\.twitter\.com\/2\/tweets\/1111111111\?/);
        assert.match(requestedUrls[1], /^https:\/\/api\.twitter\.com\/2\/tweets\/2222222222\?/);
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

describe("EmbedHandlers YouTube", () => {
    test("uses the video page JSON-LD owner profile URL when present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":"VideoObject","ownerProfileUrl":"http://www.youtube.com/@JsonLdChannel","externalChannelId":"${jsonLdChannelId}"}
                </script>
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="https://www.youtube.com/@MicrodataChannel">
                </span>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "https://www.youtube.com/@JsonLdChannel");
    });

    test("falls back to the video page JSON-LD external channel ID", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":["VideoObject"],"externalChannelId":"${jsonLdChannelId}"}
                </script>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${jsonLdChannelId}`);
    });

    test("falls back to the video page JSON-LD external channel ID when owner URL is unsafe", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":"VideoObject","ownerProfileUrl":"javascript:alert(1)","externalChannelId":"${jsonLdChannelId}"}
                </script>
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${jsonLdChannelId}`);
    });

    test("uses the video page author channel URL when present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="/@ExampleChannel">
                </span>
            `),
            "https://www.youtube.com/watch?v=example",
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, "https://www.youtube.com/@ExampleChannel");
    });

    test("falls back to the channelId metadata when no author URL is present", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(t, youtubeHtml(`<meta itemprop="channelId" content="${fallbackChannelId}">`));

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${fallbackChannelId}`);
    });

    test("uses a canonical youtube.com channel URL for youtu.be channelId metadata", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(t, youtubeHtml(`<meta itemprop="channelId" content="${fallbackChannelId}">`));

        const embed = (await EmbedHandlers["youtu.be"](new URL("https://youtu.be/example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${fallbackChannelId}`);
    });

    test("does not trust author metadata from a non-YouTube final response URL", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <script type="application/ld+json">
                    {"@context":"https://schema.org","@type":"VideoObject","ownerProfileUrl":"https://www.youtube.com/@ForgedChannel","externalChannelId":"${jsonLdChannelId}"}
                </script>
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="/@ForgedMicrodata">
                </span>
                <meta itemprop="channelId" content="${fallbackChannelId}">
            `),
            "https://evil.example/redirected",
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, undefined);
    });

    test("ignores external author URLs and falls back to the channelId metadata", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="https://evil.example/@ExampleChannel">
                </span>
                <meta itemprop="channelId" content="${fallbackChannelId}">
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${fallbackChannelId}`);
    });

    test("ignores malformed author URLs and falls back to the channelId metadata", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(
            t,
            youtubeHtml(`
                <span itemprop="author" itemscope itemtype="http://schema.org/Person">
                    <link itemprop="url" href="http://[">
                </span>
                <meta itemprop="channelId" content="${fallbackChannelId}">
            `),
        );

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, `https://www.youtube.com/channel/${fallbackChannelId}`);
    });

    test("omits author URL when channelId metadata is not a valid YouTube channel ID", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockYoutubeConfig(t, Config);
        mockFetchHtml(t, youtubeHtml(`<meta itemprop="channelId" content="../@escaped">`));

        const embed = (await EmbedHandlers["www.youtube.com"](new URL("https://www.youtube.com/watch?v=example"))) as Embed;

        assert.equal(embed.author?.name, "Example Channel");
        assert.equal(embed.author?.url, undefined);
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

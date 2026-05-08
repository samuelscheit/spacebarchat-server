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
const videoEmbedType = "video" as Embed["type"];

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
    config.limits.message.maxEmbedDownloadSize = 0;
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
    const expectedVideoEmbed = {
        url: "https://example.com/video.mp4",
        type: videoEmbedType,
        video: {
            url: "https://example.com/video.mp4",
            proxy_url: "https://example.com/video.mp4",
        },
    };

    test("creates a video embed for direct video content after one content-type probe", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        Config.get().limits.message.maxEmbedDownloadSize = 1;

        const requestedMethods: (string | undefined)[] = [];
        t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
            requestedMethods.push(init?.method);
            return new Response(null, {
                headers: {
                    "content-length": "104857600",
                    "content-type": "Video/MP4; codecs=avc1",
                },
            });
        });

        const embed = await EmbedHandlers.default(new URL("https://example.com/video.mp4"));

        assert.deepEqual(embed, expectedVideoEmbed);
        assert.deepEqual(requestedMethods, ["HEAD"]);
    });

    test("creates a video embed when only the GET response exposes direct video content", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        Config.get().limits.message.maxEmbedDownloadSize = 1;

        const requestedMethods: (string | undefined)[] = [];
        t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
            requestedMethods.push(init?.method);
            if (init?.method == "HEAD") {
                return new Response(null, {
                    status: 405,
                });
            }

            return new Response(null, {
                headers: {
                    "content-length": "104857600",
                    "content-type": "video/mp4",
                },
            });
        });

        const embed = await EmbedHandlers.default(new URL("https://example.com/video.mp4"));

        assert.deepEqual(embed, expectedVideoEmbed);
        assert.deepEqual(requestedMethods, ["HEAD", "GET"]);
    });

    test("does not treat non-media content-types containing video as direct video", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);

        const requestedMethods: (string | undefined)[] = [];
        t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
            requestedMethods.push(init?.method);
            if (init?.method == "HEAD") {
                return new Response(null, {
                    headers: {
                        "content-type": "application/x-video-metadata",
                    },
                });
            }

            return new Response("", {
                headers: {
                    "content-type": "text/html",
                },
            });
        });

        const embed = await EmbedHandlers.default(new URL("https://example.com/video-metadata"));

        assert.equal(embed, null);
        assert.deepEqual(requestedMethods, ["HEAD", "GET"]);
    });

    test("still rejects oversized non-media GET responses after probing their content-type", async (t) => {
        const { Config, EmbedHandlers } = await loadEmbedModules();
        mockEmbedConfig(t, Config, 5, 10);
        Config.get().limits.message.maxEmbedDownloadSize = 1;

        const requestedMethods: (string | undefined)[] = [];
        t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
            requestedMethods.push(init?.method);
            if (init?.method == "HEAD") {
                return new Response(null, {
                    status: 405,
                });
            }

            return new Response("<title>too large</title>", {
                headers: {
                    "content-length": "1024",
                    "content-type": "text/html",
                },
            });
        });

        const embed = await EmbedHandlers.default(new URL("https://example.com/large-page"));

        assert.equal(embed, null);
        assert.deepEqual(requestedMethods, ["HEAD", "GET"]);
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

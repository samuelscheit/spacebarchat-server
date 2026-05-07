import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../../../schemas/Validator";
import {
    AttachmentRefreshError,
    isDiscordAttachmentUrl,
    isLocalAttachmentUrl,
    parseLocalAttachmentUrl,
    refreshAttachmentUrls,
    type AttachmentUrlSignatureInput,
} from "./AttachmentRefresh";

describe("attachment URL refresh", () => {
    test("returns response objects for locally signed attachment URLs", async () => {
        const refreshed = await refreshAttachmentUrls({
            attachmentUrls: ["https://cdn.spacebar.test/attachments/1/2/file.png"],
            authorizeLocalAttachmentUrl() {
                return undefined;
            },
            localCdnEndpoint: "https://cdn.spacebar.test",
            signer(data: AttachmentUrlSignatureInput) {
                return {
                    applyToUrl(url: string | URL) {
                        const signed = new URL(url);
                        signed.searchParams.set("hm", new URL(data.url).pathname);
                        return signed;
                    },
                };
            },
        });

        assert.deepEqual(refreshed, [
            {
                original: "https://cdn.spacebar.test/attachments/1/2/file.png",
                refreshed: "https://cdn.spacebar.test/attachments/1/2/file.png?hm=%2Fattachments%2F1%2F2%2Ffile.png",
            },
        ]);
    });

    test("authorizes local attachment URLs before signing", async () => {
        const authorized: unknown[] = [];
        const refreshed = await refreshAttachmentUrls({
            attachmentUrls: ["https://cdn.spacebar.test/attachments/1/2/file.png"],
            async authorizeLocalAttachmentUrl(url, attachment) {
                authorized.push({ url, attachment });
            },
            localCdnEndpoint: "https://cdn.spacebar.test",
            signer() {
                return {
                    applyToUrl(url: string | URL) {
                        const signed = new URL(url);
                        signed.searchParams.set("signed", "true");
                        return signed;
                    },
                };
            },
        });

        assert.deepEqual(authorized, [
            {
                url: "https://cdn.spacebar.test/attachments/1/2/file.png",
                attachment: {
                    channelId: "1",
                    filename: "file.png",
                    messageId: "2",
                },
            },
        ]);
        assert.equal(refreshed[0].refreshed, "https://cdn.spacebar.test/attachments/1/2/file.png?signed=true");
    });

    test("does not sign local attachment URLs rejected by authorization", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://cdn.spacebar.test/attachments/1/2/file.png"],
                authorizeLocalAttachmentUrl() {
                    throw new AttachmentRefreshError(404, "Attachment could not be found");
                },
                localCdnEndpoint: "https://cdn.spacebar.test",
                signer() {
                    throw new Error("unauthorized URLs should not be signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 404,
        );
    });

    test("rejects local attachment URLs when no authorizer is configured", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://cdn.spacebar.test/attachments/1/2/file.png"],
                localCdnEndpoint: "https://cdn.spacebar.test",
                signer() {
                    throw new Error("unauthorized URLs should not be signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 503,
        );
    });

    test("refreshes Discord CDN URLs through Discord when a bot token is configured", async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        const refreshed = await refreshAttachmentUrls({
            attachmentUrls: ["https://cdn.discordapp.com/attachments/1/2/file.png?ex=old"],
            discordBotToken: "token",
            async fetcher(url, init) {
                calls.push({ url: url.toString(), init });
                return Response.json({
                    refreshed_urls: [
                        {
                            original: "https://cdn.discordapp.com/attachments/1/2/file.png?ex=old",
                            refreshed: "https://cdn.discordapp.com/attachments/1/2/file.png?ex=new",
                        },
                    ],
                });
            },
            signer() {
                throw new Error("Discord URLs should not be locally signed when a token is configured");
            },
        });

        assert.deepEqual(refreshed, [
            {
                original: "https://cdn.discordapp.com/attachments/1/2/file.png?ex=old",
                refreshed: "https://cdn.discordapp.com/attachments/1/2/file.png?ex=new",
            },
        ]);
        assert.equal(calls[0].url, "https://discord.com/api/v9/attachments/refresh-urls");
        assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bot token");
        assert.equal(calls[0].init?.body, JSON.stringify({ attachment_urls: ["https://cdn.discordapp.com/attachments/1/2/file.png?ex=old"] }));
    });

    test("rejects Discord URLs when no bot token is configured", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://media.discordapp.net/attachments/1/2/file.png?ex=old"],
                async fetcher() {
                    throw new Error("Discord should not be called without a token");
                },
                signer() {
                    throw new Error("Discord URLs should not be locally signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 503,
        );
    });

    test("rejects Discord CDN URLs with unsupported protocol or paths without calling Discord", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["http://cdn.discordapp.com/attachments/1/2/file.png?ex=old"],
                discordBotToken: "token",
                async fetcher() {
                    throw new Error("invalid Discord URLs should not be forwarded");
                },
                signer() {
                    throw new Error("invalid Discord URLs should not be signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 400,
        );

        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://cdn.discordapp.com/icons/1/file.png"],
                discordBotToken: "token",
                async fetcher() {
                    throw new Error("invalid Discord URLs should not be forwarded");
                },
                signer() {
                    throw new Error("invalid Discord URLs should not be signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 400,
        );
    });

    test("rejects invalid Discord refresh responses", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://cdn.discordapp.com/attachments/1/2/file.png?ex=old"],
                discordBotToken: "token",
                async fetcher() {
                    return Response.json({
                        refreshed_urls: [
                            {
                                original: "https://cdn.discordapp.com/attachments/1/2/file.png?ex=old",
                                refreshed: "https://example.com/attachments/1/2/file.png?ex=new",
                            },
                        ],
                    });
                },
                signer() {
                    throw new Error("Discord URLs should not be locally signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 502,
        );
    });

    test("rejects non-attachment URLs instead of signing arbitrary URLs", async () => {
        await assert.rejects(
            refreshAttachmentUrls({
                attachmentUrls: ["https://cdn.spacebar.test/icons/1/hash.png"],
                localCdnEndpoint: "https://cdn.spacebar.test",
                signer() {
                    throw new Error("unsupported URLs should not be signed");
                },
            }),
            (error: unknown) => error instanceof AttachmentRefreshError && error.statusCode === 400,
        );
    });

    test("classifies only strict local and Discord attachment URL shapes", () => {
        assert.equal(isLocalAttachmentUrl("https://cdn.spacebar.test/attachments/1/2/file.png", "https://cdn.spacebar.test"), true);
        assert.deepEqual(parseLocalAttachmentUrl("https://cdn.spacebar.test/attachments/1/2/file.png", "https://cdn.spacebar.test"), {
            channelId: "1",
            filename: "file.png",
            messageId: "2",
        });
        assert.equal(isLocalAttachmentUrl("https://cdn.spacebar.test/attachments/1/2/three/file.png", "https://cdn.spacebar.test"), false);
        assert.equal(isLocalAttachmentUrl("https://cdn.spacebar.test/attachments/not-a-snowflake/2/file.png", "https://cdn.spacebar.test"), false);

        assert.equal(isDiscordAttachmentUrl("https://media.discordapp.net/attachments/1/2/file.png?ex=old"), true);
        assert.equal(isDiscordAttachmentUrl("https://media.discordapp.net/ephemeral-attachments/1/2/file.png?ex=old"), true);
        assert.equal(isDiscordAttachmentUrl("http://media.discordapp.net/attachments/1/2/file.png?ex=old"), false);
        assert.equal(isDiscordAttachmentUrl("https://media.discordapp.net/icons/1/file.png"), false);
    });
});

describe("refresh URL request schema", () => {
    const validate = ajv.getSchema("RefreshUrlsRequestSchema");

    test("bounds refresh URL request size and URL length", () => {
        assert.ok(validate);

        assert.equal(validate({ attachment_urls: ["https://cdn.discordapp.com/attachments/1/2/file.png"] }), true);
        assert.equal(validate({ attachment_urls: [] }), false);
        assert.equal(validate({ attachment_urls: Array.from({ length: 51 }, () => "https://cdn.discordapp.com/attachments/1/2/file.png") }), false);
        assert.equal(validate({ attachment_urls: [`https://cdn.discordapp.com/attachments/1/2/${"a".repeat(2048)}`] }), false);
        assert.equal(validate({ attachment_urls: ["not a url"] }), false);
    });
});

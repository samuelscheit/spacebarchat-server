import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { refreshAttachmentUrls, type AttachmentUrlSignatureInput } from "./AttachmentRefresh";

describe("attachment URL refresh", () => {
    test("returns response objects for locally signed attachment URLs", async () => {
        const refreshed = await refreshAttachmentUrls({
            attachmentUrls: ["https://cdn.spacebar.test/attachments/1/file.png"],
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
                original: "https://cdn.spacebar.test/attachments/1/file.png",
                refreshed: "https://cdn.spacebar.test/attachments/1/file.png?hm=%2Fattachments%2F1%2Ffile.png",
            },
        ]);
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
            /discordAttachmentRefreshBotToken/,
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
            /Only Spacebar attachment URLs/,
        );
    });
});

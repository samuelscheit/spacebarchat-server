import { describe, test } from "node:test";
import assert from "node:assert/strict";

function assertSignedUrl(signedUrl: string, originalUrl: string) {
    const signed = new URL(signedUrl);
    const original = new URL(originalUrl);

    assert.equal(signed.origin, original.origin);
    assert.equal(signed.pathname, original.pathname);
    assert.notEqual(signed.toString(), original.toString());
    assert.ok(signed.searchParams.get("ex"));
    assert.ok(signed.searchParams.get("is"));
    assert.ok(signed.searchParams.get("hm"));
}

describe("messageToResponse", () => {
    test("preserves the public message DTO shape while signing response media urls", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { messageToResponse } = await import("./MessageResponse.js");
        const { Message } = await import("../../../util/entities/Message.js");
        const { Config } = await import("../../../util/util/Config.js");

        const attachmentUrl = "https://cdn.example/attachments/channel-id/message-id/file.png";
        const componentUrl = "https://remote.example/media/component.png?token=keep";
        const componentProxyUrl = "https://cdn.example/attachments/channel-id/message-id/component-proxy.png";
        const localComponentUrl = "https://cdn.example/attachments/channel-id/message-id/component-local.png";
        const message = new Message();
        const components = [
            {
                type: 12,
                items: [
                    {
                        media: {
                            url: componentUrl,
                            proxy_url: componentProxyUrl,
                            width: 123,
                        },
                    },
                    {
                        media: {
                            url: localComponentUrl,
                        },
                    },
                ],
            },
        ];
        const config = Config.get();

        t.mock.method(Config, "get", () => ({
            ...config,
            cdn: {
                ...config.cdn,
                endpointPublic: "https://cdn.example",
            },
        }));

        Object.assign(message, {
            id: "message-id",
            channel_id: "channel-id",
            channel: { id: "channel-id", rawRelation: true },
            author_id: "raw-author-id",
            member_id: "raw-member-id",
            author: {
                id: "raw-author-id",
                username: "raw-author",
                verified: true,
                disabled: true,
                rights: "administrator",
                data: { valid_tokens_since: "private-token-state" },
                toPublicUser() {
                    return {
                        id: "raw-author-id",
                        username: "public-author",
                        discriminator: "0000",
                        public_flags: 0,
                        avatar: null,
                    };
                },
            },
            content: undefined,
            timestamp: new Date("2026-01-02T03:04:05.000Z"),
            edited_timestamp: undefined,
            tts: undefined,
            mention_everyone: undefined,
            mentions: [],
            mention_roles: [],
            mention_channels: [],
            attachments: [
                {
                    rawAttachmentRelation: true,
                    toJSON() {
                        return {
                            filename: "file.png",
                            size: 42,
                            url: attachmentUrl,
                            proxy_url: attachmentUrl,
                        };
                    },
                },
            ],
            embeds: [],
            reactions: [
                {
                    count: 2,
                    emoji: { name: "sparkles" },
                    user_ids: ["viewer"],
                    burst_user_ids: ["other-user"],
                    burst_colors: ["#ff0000"],
                },
            ],
            pinned_at: null,
            type: 0,
            flags: 0,
            components,
            message_snapshots: [],
        });

        const req = {
            user_id: "viewer",
            ip: "203.0.113.10",
            headers: {
                "user-agent": ["first-agent", "second-agent"],
            },
        };

        const response = messageToResponse(message as never, req as never);
        const responseRecord = response as unknown as Record<string, unknown>;

        assert.equal(responseRecord.author_id, undefined);
        assert.equal(responseRecord.member_id, undefined);
        assert.equal(responseRecord.channel, undefined);
        assert.equal(response.content, "");
        assert.equal(response.tts, false);
        assert.deepEqual(response.mention_roles, []);
        assert.equal(response.pinned, false);
        assert.equal(response.timestamp, "2026-01-02T03:04:05.000Z");
        assert.deepEqual(response.reactions, [
            {
                count: 2,
                count_details: { normal: 1, burst: 1 },
                me: true,
                me_burst: false,
                emoji: { name: "sparkles" },
                burst_colors: ["#ff0000"],
            },
        ]);
        assert.equal("user_ids" in response.reactions![0], false);
        assert.equal("burst_user_ids" in response.reactions![0], false);
        assert.deepEqual(response.author, {
            id: "raw-author-id",
            username: "raw-author",
            discriminator: "0000",
            public_flags: 0,
            avatar: null,
        });
        assert.equal("verified" in response.author, false);
        assert.equal("disabled" in response.author, false);
        assert.equal("rights" in response.author, false);
        assert.equal("data" in response.author, false);

        assert.equal(response.attachments.length, 1);
        assert.equal(response.attachments[0].filename, "file.png");
        assert.equal(response.attachments[0].size, 42);
        assert.equal("rawAttachmentRelation" in response.attachments[0], false);
        assertSignedUrl(response.attachments[0].url, attachmentUrl);
        assertSignedUrl(response.attachments[0].proxy_url, attachmentUrl);

        const responseComponents = response.components as unknown as typeof components;
        const responseMedia = responseComponents[0].items[0].media;
        assert.equal(responseMedia.width, 123);
        assert.equal(responseMedia.url, componentUrl);
        assertSignedUrl(responseMedia.proxy_url, componentProxyUrl);
        assertSignedUrl(responseComponents[0].items[1].media.url, localComponentUrl);
        assert.equal(components[0].items[0].media.url, componentUrl);
        assert.equal(components[0].items[0].media.proxy_url, componentProxyUrl);
        assert.equal(components[0].items[1].media.url, localComponentUrl);
    });

    test("normalizes request user-agent headers for signature data", async () => {
        const { requestUrlSignatureData } = await import("./MessageResponse.js");

        assert.equal(
            requestUrlSignatureData({
                ip: "203.0.113.10",
                headers: { "user-agent": ["first-agent", "second-agent"] },
            } as never).userAgent,
            "first-agent",
        );
        assert.equal(
            requestUrlSignatureData({
                ip: "203.0.113.10",
                headers: {},
            } as never).userAgent,
            undefined,
        );
    });
});

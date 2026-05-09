import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { messageToPublicMessage } from "./MessagePublic";

describe("messageToPublicMessage", () => {
    test("serializes sticker items as public message sticker item DTOs", () => {
        const publicMessage = messageToPublicMessage({
            id: "message-id",
            channel_id: "channel-id",
            timestamp: new Date("2026-01-02T03:04:05.000Z"),
            flags: 0,
            pinned: false,
            type: 0,
            sticker_items: [
                {
                    id: "sticker-id",
                    name: "wave",
                    format_type: 1,
                    guild_id: "guild-id",
                    tags: "hello,wave",
                },
            ],
        } as unknown as Parameters<typeof messageToPublicMessage>[0]);

        assert.deepEqual(publicMessage.sticker_items, [{ id: "sticker-id", name: "wave", format_type: 1 }]);
        assert.equal((publicMessage.sticker_items?.[0] as { guild_id?: string }).guild_id, undefined);
        assert.equal((publicMessage.sticker_items?.[0] as { tags?: string }).tags, undefined);
    });
});

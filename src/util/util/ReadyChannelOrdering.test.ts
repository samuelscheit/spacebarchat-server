import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChannelType } from "../../schemas/api/channels/Channel";
import { applyReadyChannelOrdering } from "./ReadyChannelOrdering";

describe("applyReadyChannelOrdering", () => {
    it("sorts top-level channels by guild channel ordering", () => {
        const channels = [{ id: "text" }, { id: "category" }, { id: "voice" }];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["category", "text", "voice"]).map((channel) => [channel.id, channel.position]),
            [
                ["category", 0],
                ["text", 1],
                ["voice", 2],
            ],
        );
    });

    it("places channels missing from channel_ordering after ordered channels", () => {
        const channels = [{ id: "orphan-child" }, { id: "category" }, { id: "ordered-child" }];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["category", "ordered-child"]).map((channel) => [channel.id, channel.position]),
            [
                ["category", 0],
                ["ordered-child", 1],
                ["orphan-child", 2],
            ],
        );
    });

    it("keeps missing channels in their existing relative order", () => {
        const channels = [{ id: "first-missing" }, { id: "ordered" }, { id: "second-missing" }];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["ordered"]).map((channel) => [channel.id, channel.position]),
            [
                ["ordered", 0],
                ["first-missing", 1],
                ["second-missing", 2],
            ],
        );
    });

    it("places missing channels after all ordering entries when channel_ordering has duplicates", () => {
        const channels = [{ id: "missing" }, { id: "ordered" }];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["ordered", "ordered"]).map((channel) => [channel.id, channel.position]),
            [
                ["ordered", 0],
                ["missing", 1],
            ],
        );
    });

    it("places category children after the parent with sibling-local positions", () => {
        const channels = [
            { id: "second-child", parent_id: "category", type: ChannelType.GUILD_TEXT },
            { id: "top-text", type: ChannelType.GUILD_TEXT },
            { id: "category", type: ChannelType.GUILD_CATEGORY },
            { id: "first-child", parent_id: "category", type: ChannelType.GUILD_TEXT },
        ];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["category", "first-child", "second-child", "top-text"]).map((channel) => [channel.id, channel.position]),
            [
                ["category", 0],
                ["first-child", 0],
                ["second-child", 1],
                ["top-text", 1],
            ],
        );
    });

    it("keeps category children grouped when a child is ordered but the category is missing", () => {
        const channels = [
            { id: "child", parent_id: "category", type: ChannelType.GUILD_TEXT },
            { id: "category", type: ChannelType.GUILD_CATEGORY },
            { id: "top-text", type: ChannelType.GUILD_TEXT },
        ];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["top-text", "child"]).map((channel) => [channel.id, channel.position]),
            [
                ["top-text", 0],
                ["category", 1],
                ["child", 0],
            ],
        );
    });

    it("ranks a missing category by its earliest ordered child", () => {
        const channels = [
            { id: "child", parent_id: "category", type: ChannelType.GUILD_TEXT },
            { id: "category", type: ChannelType.GUILD_CATEGORY },
            { id: "top-text", type: ChannelType.GUILD_TEXT },
        ];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["child", "top-text"]).map((channel) => [channel.id, channel.position]),
            [
                ["category", 0],
                ["child", 0],
                ["top-text", 1],
            ],
        );
    });

    it("treats channels with missing parent categories as top-level channels", () => {
        const channels = [
            { id: "orphan", parent_id: "missing-category", type: ChannelType.GUILD_TEXT },
            { id: "top-text", type: ChannelType.GUILD_TEXT },
        ];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["top-text", "orphan"]).map((channel) => [channel.id, channel.position]),
            [
                ["top-text", 0],
                ["orphan", 1],
            ],
        );
    });

    it("does not group children under non-category parents", () => {
        const channels = [
            { id: "child", parent_id: "forum", type: ChannelType.GUILD_PUBLIC_THREAD },
            { id: "forum", type: ChannelType.GUILD_FORUM },
        ];

        assert.deepEqual(
            applyReadyChannelOrdering(channels, ["forum", "child"]).map((channel) => [channel.id, channel.position]),
            [
                ["forum", 0],
                ["child", 1],
            ],
        );
    });
});

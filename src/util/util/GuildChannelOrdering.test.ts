import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapTemplateChannelOrdering, sortChannelsByChannelOrdering, sortTemplateChannelsForCreation } from "./GuildChannelOrdering";

describe("template channel ordering", () => {
    test("creates channels in template order when parents already precede children", () => {
        const channels = sortTemplateChannelsForCreation([
            { id: "category", position: 3 },
            { id: "child-1", parent_id: "category", position: 999 },
            { id: "child-2", parent_id: "category", position: 0 },
            { id: "text", position: 0 },
        ]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child-1", "child-2", "text"],
        );
    });

    test("creates parent channels before children when template input is malformed", () => {
        const channels = sortTemplateChannelsForCreation([
            { id: "child", parent_id: "category", position: 0 },
            { id: "category", position: 1 },
            { id: "text", position: 2 },
        ]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child", "text"],
        );
    });

    test("maps imported guild ordering from serialized template order instead of stale positions", () => {
        const serializedChannels = [
            { id: "category", position: 3 },
            { id: "child-1", parent_id: "category", position: 999 },
            { id: "child-2", parent_id: "category", position: 0 },
            { id: "text", position: 0 },
        ];
        const createdIds = new Map(serializedChannels.map((channel) => [channel, `new-${channel.id}`]));

        assert.deepEqual(
            mapTemplateChannelOrdering(serializedChannels, (channel) => createdIds.get(channel)),
            ["new-category", "new-child-1", "new-child-2", "new-text"],
        );
    });

    test("serializes template channels in stored guild ordering", () => {
        const channels = sortChannelsByChannelOrdering([{ id: "child-2" }, { id: "category" }, { id: "child-1" }, { id: "untracked" }], ["category", "child-1", "child-2"]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child-1", "child-2", "untracked"],
        );
    });
});

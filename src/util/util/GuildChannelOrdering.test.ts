import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getTemplateChannelInsertPoint, sortChannelsByChannelOrdering, sortTemplateChannelsForCreation } from "./GuildChannelOrdering";

describe("template channel ordering", () => {
    test("creates parent channels before children while preserving sibling positions", () => {
        const channels = sortTemplateChannelsForCreation([
            { id: "child-2", parent_id: "category", position: 1 },
            { id: "text", position: 1 },
            { id: "child-1", parent_id: "category", position: 0 },
            { id: "category", position: 0 },
        ]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "text", "child-1", "child-2"],
        );
    });

    test("inserts later category children after earlier siblings", () => {
        const ordering = ["category"];
        const lastChildByParent = new Map<string, string>();

        let insertPoint = getTemplateChannelInsertPoint({ id: "child-1", parent_id: "category", position: 0 }, "category", lastChildByParent);
        assert.equal(insertPoint, "category");
        ordering.splice(ordering.indexOf(insertPoint) + 1, 0, "child-1");
        lastChildByParent.set("category", "child-1");

        insertPoint = getTemplateChannelInsertPoint({ id: "child-2", parent_id: "category", position: 1 }, "category", lastChildByParent);
        assert.equal(insertPoint, "child-1");
        ordering.splice(ordering.indexOf(insertPoint) + 1, 0, "child-2");

        assert.deepEqual(ordering, ["category", "child-1", "child-2"]);
    });

    test("serializes template channels in stored guild ordering", () => {
        const channels = sortChannelsByChannelOrdering([{ id: "child-2" }, { id: "category" }, { id: "child-1" }, { id: "untracked" }], ["category", "child-1", "child-2"]);

        assert.deepEqual(
            channels.map((channel) => channel.id),
            ["category", "child-1", "child-2", "untracked"],
        );
    });
});

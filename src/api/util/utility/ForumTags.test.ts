import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Channel, ObjectErrorContent, Tag } from "@spacebar/util";
import { getAvailableTagsModifyError, replaceForumAvailableTags } from "./ForumTags";

let saved: string[] = [];
let removed: string[] = [];

function createTag(overrides: Partial<Tag> = {}) {
    const tag = new Tag();
    Object.assign(tag, {
        id: overrides.id ?? `tag-${Math.random()}`,
        name: overrides.name ?? "tag",
        moderated: overrides.moderated ?? false,
        emoji_id: overrides.emoji_id,
        emoji_name: overrides.emoji_name,
        save: async function save(this: Tag) {
            saved.push(this.id);
            return this;
        },
        remove: async function remove(this: Tag) {
            removed.push(this.id);
            return this;
        },
        ...overrides,
    });
    return tag;
}

function createForumChannel(tags: Tag[]) {
    const channel = new Channel();
    channel.id = "forum-id";
    channel.available_tags = tags;
    channel.isForum = () => true;
    return channel;
}

describe("forum available tag replacement", () => {
    test("updates existing tags, creates new tags, removes omitted tags, and awaits persistence", async () => {
        saved = [];
        removed = [];
        const originalCreate = Tag.create;
        const createdTag = createTag({ id: "new-tag" });
        Tag.create = ((payload: Partial<Tag>) => Object.assign(createdTag, payload)) as typeof Tag.create;

        try {
            const keep = createTag({ id: "keep", name: "old", moderated: false, emoji_id: "old-emoji" });
            const remove = createTag({ id: "remove" });
            const channel = createForumChannel([keep, remove]);

            await replaceForumAvailableTags(channel, [
                { id: "keep", name: "updated", moderated: true, emoji_name: "🔥" },
                { name: "created", moderated: null, emoji_id: null, emoji_name: null },
            ]);

            assert.deepEqual(
                channel.available_tags?.map((tag) => tag.id),
                ["keep", "new-tag"],
            );
            assert.equal(keep.name, "updated");
            assert.equal(keep.moderated, true);
            assert.equal(keep.emoji_id, undefined);
            assert.equal(keep.emoji_name, "🔥");
            assert.equal(createdTag.channel, channel);
            assert.equal(createdTag.channel_id, "forum-id");
            assert.equal(createdTag.name, "created");
            assert.equal(createdTag.moderated, false);
            assert.deepEqual(saved.sort(), ["keep", "new-tag"].sort());
            assert.deepEqual(removed, ["remove"]);
        } finally {
            Tag.create = originalCreate;
        }
    });

    test("reports unknown and duplicate tag ids", () => {
        const channel = createForumChannel([createTag({ id: "known" })]);

        const unknownErrors = getAvailableTagsModifyError(channel, [{ id: "missing", name: "bad" }]);
        assert.deepEqual((unknownErrors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Unknown tag missing",
        });

        const duplicateErrors = getAvailableTagsModifyError(channel, [
            { id: "known", name: "one" },
            { id: "known", name: "two" },
        ]);
        assert.deepEqual((duplicateErrors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Duplicate tag id known",
        });
    });

    test("rejects available tag modification for non-forum channels", () => {
        const channel = new Channel();
        channel.isForum = () => false;

        const errors = getAvailableTagsModifyError(channel, [{ name: "tag" }]);

        assert.deepEqual((errors?.available_tags as ObjectErrorContent | undefined)?._errors[0], {
            code: "BASE_TYPE_BAD_VALUE",
            message: "Available tags can only be set on forum channels",
        });
    });
});

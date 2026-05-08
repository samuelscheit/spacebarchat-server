import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { MessageEditSchema, StoredReaction } from "@spacebar/schemas";
import { buildMessageEditComponentProcessingOptions, buildMessageEditHandleMessageOptions, preserveEditedMessageReactions } from "./MessageEdit";
import { ajv } from "../../schemas/Validator";

describe("Message edit helpers", () => {
    test("preserves existing reactions when an edit omits reactions", () => {
        const reactions = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];

        assert.equal(preserveEditedMessageReactions(reactions), reactions);
    });

    test("defaults missing reactions to an empty array", () => {
        assert.deepEqual(preserveEditedMessageReactions(undefined), []);
        assert.deepEqual(preserveEditedMessageReactions(null), []);
    });

    test("passes persisted reactions across the edit route/handler boundary", () => {
        const reactions: StoredReaction[] = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];
        const editedAt = new Date("2026-01-02T03:04:05.000Z");

        const options = buildMessageEditHandleMessageOptions(
            {
                author_id: "author_id",
                channel_id: "old_channel_id",
                content: "before",
                message_reference: { message_id: "referenced_message_id" },
                reactions,
            },
            { content: "after" },
            "channel_id",
            "message_id",
            editedAt,
        );

        assert.equal(options.content, "after");
        assert.equal(options.author_id, "author_id");
        assert.equal(options.channel_id, "channel_id");
        assert.equal(options.id, "message_id");
        assert.equal(options.edited_timestamp, editedAt);
        assert.equal(options.reactions, reactions);
        assert.deepEqual(options.message_reference, { message_id: "referenced_message_id" });
    });

    test("tracks whether edit payloads explicitly update components", () => {
        assert.deepEqual(buildMessageEditComponentProcessingOptions({ content: "after" }), { process_component_media: false });
        assert.deepEqual(buildMessageEditComponentProcessingOptions({ components: [] }), { process_component_media: true });
        assert.deepEqual(buildMessageEditComponentProcessingOptions({ components: undefined }), { process_component_media: true });
    });

    test("builds interaction callback edit options without dropping omitted existing attachments", () => {
        const editedAt = new Date("2026-01-02T03:04:05.000Z");
        const existingAttachment = { id: "attachment_id", filename: "before.txt" };
        const existingComponents = [{ type: 1, components: [] }];
        const body = { content: "after", embeds: [] };

        const options = buildMessageEditHandleMessageOptions(
            {
                attachments: [existingAttachment],
                author_id: "application_id",
                channel_id: "channel_id",
                components: existingComponents,
                content: "before",
                reactions: [],
            },
            body,
            "channel_id",
            "message_id",
            editedAt,
            {
                attachment_user_id: "interaction_user_id",
                attachment_channel_ids: ["channel_id"],
                is_edit: true,
                ...buildMessageEditComponentProcessingOptions(body),
            },
        );

        assert.equal(options.id, "message_id");
        assert.equal(options.author_id, "application_id");
        assert.equal(options.content, "after");
        assert.equal(options.components, existingComponents);
        assert.deepEqual(options.embeds, []);
        assert.equal(options.attachments?.[0], existingAttachment);
        assert.deepEqual(options.attachment_channel_ids, ["channel_id"]);
        assert.equal(options.attachment_user_id, "interaction_user_id");
        assert.equal(options.edited_timestamp, editedAt);
        assert.equal(options.is_edit, true);
        assert.equal(options.process_component_media, false);
    });

    test("does not allow edit payload reactions to replace persisted reactions", () => {
        const persisted: StoredReaction[] = [{ count: 1, emoji: { name: "thumb" }, user_ids: ["user_id"] }];
        const incoming: StoredReaction[] = [{ count: 2, emoji: { name: "fire" }, user_ids: ["user_id", "other_user_id"] }];
        const body = { content: "after", reactions: incoming } as MessageEditSchema & { reactions: StoredReaction[] };

        const options = buildMessageEditHandleMessageOptions(
            {
                author_id: "author_id",
                content: "before",
                reactions: persisted,
            },
            body,
            "channel_id",
            "message_id",
        );

        assert.equal(options.content, "after");
        assert.equal(options.reactions, persisted);
    });

    test("generated MessageEditSchema rejects client-supplied reactions", () => {
        const validate = ajv.getSchema("MessageEditSchema");
        assert.ok(validate);

        const valid = validate({
            content: "after",
            reactions: [{ count: 2, emoji: { name: "fire" }, user_ids: ["user_id", "other_user_id"] }],
        });

        assert.equal(valid, false);
        assert.ok(
            validate.errors?.some((error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "reactions"),
            "reactions should remain outside the message edit request schema",
        );
    });
});

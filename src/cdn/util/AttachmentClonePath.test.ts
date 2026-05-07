import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAttachmentCloneDestinationPath } from "./AttachmentClonePath";

describe("getAttachmentCloneDestinationPath", () => {
    test("defaults clone destination paths to the source channel", () => {
        assert.equal(
            getAttachmentCloneDestinationPath({
                sourceChannelId: "source-channel",
                messageId: "message-id",
                filename: "image.png",
            }),
            "attachments/source-channel/message-id/image.png",
        );
    });

    test("uses the destination message channel when cloning parent-channel thread uploads", () => {
        assert.equal(
            getAttachmentCloneDestinationPath({
                sourceChannelId: "parent-channel",
                destinationChannelId: "thread-channel",
                messageId: "message-id",
                filename: "image.png",
            }),
            "attachments/thread-channel/message-id/image.png",
        );
    });
});

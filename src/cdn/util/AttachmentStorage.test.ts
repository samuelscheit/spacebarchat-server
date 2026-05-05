import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachmentStoragePath, legacyAttachmentStoragePath } from "./AttachmentStorage";

describe("attachment storage paths", () => {
    it("uses message ids for current attachment storage paths", () => {
        assert.equal(
            attachmentStoragePath({
                channelId: "channel",
                messageId: "message",
                filename: "file.png",
            }),
            "attachments/channel/message/file.png",
        );
    });

    it("can address the legacy attachment-id storage layout", () => {
        assert.equal(
            legacyAttachmentStoragePath({
                channelId: "channel",
                attachmentId: "attachment",
                filename: "file.png",
            }),
            "attachments/channel/attachment/file.png",
        );
    });
});

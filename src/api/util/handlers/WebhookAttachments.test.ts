import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mergeWebhookMessageAttachments } from "./WebhookAttachments";

describe("mergeWebhookMessageAttachments", () => {
    test("keeps uploaded attachments when the body has no descriptors", () => {
        const uploadedAttachments = [{ id: "uploaded" }];

        assert.deepEqual(mergeWebhookMessageAttachments(uploadedAttachments), uploadedAttachments);
    });

    test("appends cloud body attachment descriptors after uploaded attachments", () => {
        const uploadedAttachment = { id: "uploaded" };
        const plainBodyAttachment = {
            id: "0",
            filename: "image.png",
        };
        const cloudBodyAttachment = {
            filename: "image.png",
            uploaded_filename: "attachments/100000000000000001/0/image.png",
        };

        assert.deepEqual(mergeWebhookMessageAttachments([uploadedAttachment], [plainBodyAttachment, cloudBodyAttachment]), [uploadedAttachment, cloudBodyAttachment]);
    });
});

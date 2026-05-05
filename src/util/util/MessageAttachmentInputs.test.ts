import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getAttachmentFilename, normalizeMessageAttachmentInputs } from "./MessageAttachmentInputs";

describe("Message attachment input helpers", () => {
    test("keeps cloud attachments for message processing", () => {
        const { cloudAttachments, uploadMetadata } = normalizeMessageAttachmentInputs(
            [{ id: "0", filename: "plain.png" }],
            [
                { id: "1", file: "image.png", name: "renamed.png" },
                { id: "2", filename: "cloud.png", uploaded_filename: "channel/upload/cloud.png" },
            ],
        );

        assert.deepEqual(cloudAttachments, [{ id: "2", filename: "cloud.png", uploaded_filename: "channel/upload/cloud.png" }]);
        assert.deepEqual(uploadMetadata, [
            { id: "0", filename: "plain.png" },
            { id: "1", file: "image.png", name: "renamed.png" },
        ]);
    });

    test("resolves filenames from Discord.js files metadata", () => {
        assert.equal(getAttachmentFilename({ file: "fixtures/image.png", name: "renamed.png" }), "renamed.png");
        assert.equal(getAttachmentFilename({ file: "fixtures/image.png" }), "image.png");
        assert.equal(getAttachmentFilename({ id: "0", filename: "plain.png" }), "plain.png");
    });
});

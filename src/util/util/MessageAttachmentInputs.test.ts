import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    getAttachmentFilename,
    getCloudAttachmentAccessError,
    getMultipartUploadAttachmentId,
    getUploadInputForMultipartFile,
    normalizeMessageAttachmentInputs,
    MessageAttachmentUploadInput,
} from "./MessageAttachmentInputs";

function consume(input: MessageAttachmentUploadInput | undefined, consumed: Set<MessageAttachmentUploadInput>) {
    if (input) consumed.add(input);
    return input;
}

describe("Message attachment input helpers", () => {
    test("preserves caller order for mixed cloud and upload metadata", () => {
        const inputs = normalizeMessageAttachmentInputs(
            [{ id: "0" }, { id: "1", filename: "cloud.png", uploaded_filename: "channel/upload/cloud.png" }, { id: "2", filename: "plain.png" }],
            undefined,
        );

        assert.deepEqual(
            inputs.map((input) => ({ type: input.type, id: input.id, filename: getAttachmentFilename(input.metadata) })),
            [
                { type: "upload", id: "0", filename: undefined },
                { type: "cloud", id: "1", filename: "cloud.png" },
                { type: "upload", id: "2", filename: "plain.png" },
            ],
        );
    });

    test("merges top-level file metadata into matching attachment metadata", () => {
        const inputs = normalizeMessageAttachmentInputs(
            [{ id: "0" }],
            [
                { id: "0", file: "fixtures/image.png", name: "renamed.png" },
                { id: "1", filename: "second.png" },
            ],
        );

        assert.equal(inputs.length, 2);
        assert.equal(inputs[0].type, "upload");
        assert.equal(getAttachmentFilename(inputs[0].metadata), "renamed.png");
        assert.equal(inputs[1].type, "upload");
        assert.equal(getAttachmentFilename(inputs[1].metadata), "second.png");
    });

    test("resolves filenames from Discord.js files metadata", () => {
        assert.equal(getAttachmentFilename({ file: "fixtures/image.png", name: "renamed.png" }), "renamed.png");
        assert.equal(getAttachmentFilename({ file: "fixtures/image.png" }), "image.png");
        assert.equal(getAttachmentFilename({ id: "0", filename: "plain.png" }), "plain.png");
    });

    test("extracts multipart upload ids from Discord file field names", () => {
        assert.equal(getMultipartUploadAttachmentId({ fieldname: "files[0]" }), "0");
        assert.equal(getMultipartUploadAttachmentId({ fieldname: "file[12]" }), "12");
        assert.equal(getMultipartUploadAttachmentId({ fieldname: "file" }), "0");
        assert.equal(getMultipartUploadAttachmentId({ fieldname: "files" }), "0");
        assert.equal(getMultipartUploadAttachmentId({ fieldname: "avatar" }), undefined);
    });

    test("matches out-of-order multipart uploads by field id", () => {
        const inputs = normalizeMessageAttachmentInputs(
            [
                { id: "0", filename: "zero.png" },
                { id: "1", filename: "one.png" },
            ],
            undefined,
        );
        const consumed = new Set<MessageAttachmentUploadInput>();

        const second = consume(getUploadInputForMultipartFile({ fieldname: "files[1]", originalname: "raw-one.png" }, inputs, consumed), consumed);
        const first = consume(getUploadInputForMultipartFile({ fieldname: "files[0]", originalname: "raw-zero.png" }, inputs, consumed), consumed);

        assert.equal(getAttachmentFilename(second?.metadata), "one.png");
        assert.equal(getAttachmentFilename(first?.metadata), "zero.png");
    });

    test("falls back to metadata order when multipart fields have no Discord file id", () => {
        const inputs = normalizeMessageAttachmentInputs(
            [
                { id: "0", filename: "first.png" },
                { id: "1", filename: "second.png" },
            ],
            undefined,
        );
        const consumed = new Set<MessageAttachmentUploadInput>();

        const first = consume(getUploadInputForMultipartFile({ fieldname: "upload", originalname: "raw-first.png" }, inputs, consumed), consumed);
        const second = consume(getUploadInputForMultipartFile({ fieldname: "upload", originalname: "raw-second.png" }, inputs, consumed), consumed);

        assert.equal(getAttachmentFilename(first?.metadata), "first.png");
        assert.equal(getAttachmentFilename(second?.metadata), "second.png");
    });

    test("validates cloud attachment channel and user ownership", () => {
        assert.equal(getCloudAttachmentAccessError({ channelId: "10", userId: "20" }, "10", "20"), undefined);
        assert.deepEqual(getCloudAttachmentAccessError({ channelId: "11", userId: "20" }, "10", "20"), {
            message: "Attachment does not belong to this channel",
            status: 400,
        });
        assert.deepEqual(getCloudAttachmentAccessError({ channelId: "10", userId: "21" }, "10", "20"), {
            message: "You do not own this attachment",
            status: 403,
        });
        assert.equal(getCloudAttachmentAccessError({ channelId: "10", userId: "21" }, "10"), undefined);
    });
});

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { findCloudAttachmentForChannel, getCloudAttachmentChannelLookup, getCloudAttachmentCloneUrl, getCloudAttachmentLookupChannelId } from "./CloudAttachmentLookup";

describe("getCloudAttachmentChannelLookup", () => {
    test("scopes cloud attachments by uploaded filename and expected upload channel", () => {
        assert.deepEqual(getCloudAttachmentChannelLookup("attachments/source/CLOUD_batch/0/image.png", "upload-channel"), {
            uploadFilename: "attachments/source/CLOUD_batch/0/image.png",
            channelId: "upload-channel",
        });
    });
});

describe("getCloudAttachmentLookupChannelId", () => {
    test("defaults the upload lookup channel to the destination channel", () => {
        assert.equal(getCloudAttachmentLookupChannelId("message-channel"), "message-channel");
    });

    test("allows thread starter messages to look up parent-channel pre-uploads", () => {
        assert.equal(getCloudAttachmentLookupChannelId("new-thread-channel", "parent-channel"), "parent-channel");
    });
});

describe("getCloudAttachmentCloneUrl", () => {
    test("passes the destination message channel to the internal CDN clone endpoint", () => {
        assert.equal(
            getCloudAttachmentCloneUrl("http://cdn.internal", "parent-channel/CLOUD_batch/0/image.png", "message-id", "thread-channel"),
            "http://cdn.internal/attachments/parent-channel/CLOUD_batch/0/image.png/clone_to_message/message-id?destination_channel_id=thread-channel",
        );
    });
});

describe("findCloudAttachmentForChannel", () => {
    test("returns repository matches scoped to the expected upload channel", async () => {
        const storedAttachment = { id: "cloud-attachment" };
        const calls: unknown[] = [];
        const repository = {
            async findOne(options: { where: ReturnType<typeof getCloudAttachmentChannelLookup> }) {
                calls.push(options);
                return storedAttachment;
            },
        };

        const result = await findCloudAttachmentForChannel(repository, "attachments/source/CLOUD_batch/0/image.png", "upload-channel");

        assert.equal(result, storedAttachment);
        assert.deepEqual(calls, [
            {
                where: {
                    uploadFilename: "attachments/source/CLOUD_batch/0/image.png",
                    channelId: "upload-channel",
                },
            },
        ]);
    });

    test("rejects missing or foreign-channel descriptors before cloning", async () => {
        let lookup: unknown;
        const repository = {
            async findOne(options: { where: ReturnType<typeof getCloudAttachmentChannelLookup> }) {
                lookup = options;
                return null;
            },
        };

        await assert.rejects(
            () => findCloudAttachmentForChannel(repository, "attachments/source/CLOUD_batch/0/image.png", "upload-channel"),
            (error) => {
                assert(error instanceof Error);
                assert.equal((error as { code?: number }).code, 400);
                assert.match(error.message, /Attachment does not belong to this channel/);
                return true;
            },
        );
        assert.deepEqual(lookup, {
            where: {
                uploadFilename: "attachments/source/CLOUD_batch/0/image.png",
                channelId: "upload-channel",
            },
        });
    });
});

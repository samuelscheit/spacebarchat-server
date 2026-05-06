import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { findCloudAttachmentForDestination, getCloudAttachmentDestinationLookup, getCloudAttachmentLookupChannelId } from "./CloudAttachmentLookup";

describe("getCloudAttachmentDestinationLookup", () => {
    test("scopes cloud attachments by uploaded filename and destination channel", () => {
        assert.deepEqual(getCloudAttachmentDestinationLookup("attachments/source/CLOUD_batch/0/image.png", "destination-channel"), {
            uploadFilename: "attachments/source/CLOUD_batch/0/image.png",
            channelId: "destination-channel",
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

describe("findCloudAttachmentForDestination", () => {
    test("returns repository matches scoped to the destination channel", async () => {
        const storedAttachment = { id: "cloud-attachment" };
        const calls: unknown[] = [];
        const repository = {
            async findOne(options: { where: ReturnType<typeof getCloudAttachmentDestinationLookup> }) {
                calls.push(options);
                return storedAttachment;
            },
        };

        const result = await findCloudAttachmentForDestination(repository, "attachments/source/CLOUD_batch/0/image.png", "destination-channel");

        assert.equal(result, storedAttachment);
        assert.deepEqual(calls, [
            {
                where: {
                    uploadFilename: "attachments/source/CLOUD_batch/0/image.png",
                    channelId: "destination-channel",
                },
            },
        ]);
    });

    test("rejects missing or foreign-channel descriptors before cloning", async () => {
        let lookup: unknown;
        const repository = {
            async findOne(options: { where: ReturnType<typeof getCloudAttachmentDestinationLookup> }) {
                lookup = options;
                return null;
            },
        };

        await assert.rejects(
            () => findCloudAttachmentForDestination(repository, "attachments/source/CLOUD_batch/0/image.png", "destination-channel"),
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
                channelId: "destination-channel",
            },
        });
    });
});

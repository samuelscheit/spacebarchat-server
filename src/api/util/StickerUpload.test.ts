import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { StickerFormatType } from "../../schemas/api/guilds/Sticker";
import { UnsupportedStickerMimeTypeError, buildGuildStickerMetadata, createGuildStickerUpload, getStickerFormat } from "./StickerUpload";

const baseBody = {
    name: "wave",
    tags: "hello",
    description: "waves hello",
};

function createFile(mimetype: string) {
    return {
        buffer: Buffer.from("sticker"),
        mimetype,
        originalname: "sticker",
    };
}

describe("guild sticker upload persistence", () => {
    test("does not save sticker metadata when the CDN upload rejects the file", async () => {
        const uploadError = new Error("cdn rejected upload");
        let saveCalls = 0;

        await assert.rejects(
            createGuildStickerUpload({
                body: baseBody,
                file: createFile("image/gif"),
                guild_id: "guild-id",
                id: "sticker-id",
                user_id: "user-id",
                createSticker: (metadata) => metadata,
                deleteUploadedFile: async () => undefined,
                upload: async () => {
                    throw uploadError;
                },
                saveSticker: async (metadata) => {
                    saveCalls++;
                    return metadata;
                },
            }),
            uploadError,
        );

        assert.equal(saveCalls, 0);
    });

    test("removes the uploaded file when saving sticker metadata fails", async () => {
        const saveError = new Error("database rejected sticker");
        const deletedPaths: string[] = [];

        await assert.rejects(
            createGuildStickerUpload({
                body: baseBody,
                file: createFile("image/png"),
                guild_id: "guild-id",
                id: "sticker-id",
                user_id: "user-id",
                createSticker: (metadata) => metadata,
                upload: async () => ({ content_type: "image/png" }),
                deleteUploadedFile: async (path) => {
                    deletedPaths.push(path);
                },
                saveSticker: async () => {
                    throw saveError;
                },
            }),
            saveError,
        );

        assert.deepEqual(deletedPaths, ["/stickers/sticker-id"]);
    });

    test("uses the CDN-sniffed content type for the stored sticker format", async () => {
        const sticker = await createGuildStickerUpload({
            body: baseBody,
            file: createFile("image/png"),
            guild_id: "guild-id",
            id: "sticker-id",
            user_id: "user-id",
            createSticker: (metadata) => metadata,
            deleteUploadedFile: async () => undefined,
            upload: async () => ({ content_type: "image/gif" }),
            saveSticker: async (sticker) => sticker,
        });

        assert.equal(sticker.format_type, StickerFormatType.GIF);
    });

    test("removes the uploaded file when accepted CDN content cannot be stored as a sticker", async () => {
        const deletedPaths: string[] = [];

        await assert.rejects(
            createGuildStickerUpload({
                body: baseBody,
                file: createFile("image/png"),
                guild_id: "guild-id",
                id: "sticker-id",
                user_id: "user-id",
                createSticker: (metadata) => metadata,
                deleteUploadedFile: async (path) => {
                    deletedPaths.push(path);
                },
                upload: async () => ({ content_type: "image/webp" }),
                saveSticker: async (sticker) => sticker,
            }),
            UnsupportedStickerMimeTypeError,
        );

        assert.deepEqual(deletedPaths, ["/stickers/sticker-id"]);
    });
});

describe("sticker format resolution", () => {
    test("falls back to the uploaded MIME type when the CDN result has no content type", async () => {
        const sticker = await createGuildStickerUpload({
            body: baseBody,
            file: createFile("image/png"),
            guild_id: "guild-id",
            id: "sticker-id",
            user_id: "user-id",
            createSticker: (metadata) => metadata,
            deleteUploadedFile: async () => undefined,
            upload: async () => ({}),
            saveSticker: async (sticker) => sticker,
        });

        assert.equal(sticker.format_type, StickerFormatType.PNG);
    });

    test("rejects unsupported sticker MIME types", () => {
        assert.throws(() => getStickerFormat("image/jpeg"), {
            name: UnsupportedStickerMimeTypeError.name,
            message: "invalid sticker format: must be png, apng or lottie",
        });
    });

    test("returns the expected sticker format enum values", () => {
        assert.equal(getStickerFormat("image/apng"), StickerFormatType.APNG);
        assert.equal(getStickerFormat("application/json"), StickerFormatType.LOTTIE);
        assert.equal(getStickerFormat("image/png"), StickerFormatType.PNG);
        assert.equal(getStickerFormat("image/gif"), StickerFormatType.GIF);
    });

    test("builds stored metadata from accepted upload content type", () => {
        assert.deepEqual(
            buildGuildStickerMetadata({
                body: baseBody,
                content_type: "image/apng",
                guild_id: "guild-id",
                id: "sticker-id",
                user_id: "user-id",
            }),
            {
                ...baseBody,
                available: true,
                format_type: StickerFormatType.APNG,
                guild_id: "guild-id",
                id: "sticker-id",
                type: 2,
                user_id: "user-id",
            },
        );
    });
});

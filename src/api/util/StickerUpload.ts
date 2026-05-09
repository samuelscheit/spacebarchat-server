import { StickerFormatType, StickerType } from "../../schemas/api/guilds/Sticker";
import type { ModifyGuildStickerSchema } from "../../schemas/uncategorised/ModifyGuildStickerSchema";

type StickerUploadFile = {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
};
type StickerUploadResult = {
    content_type?: string;
};
type UploadStickerFile = (path: string, file: StickerUploadFile) => Promise<StickerUploadResult>;
type DeleteStickerFile = (path: string) => Promise<unknown>;

export type GuildStickerMetadata = ModifyGuildStickerSchema & {
    available: true;
    format_type: StickerFormatType;
    guild_id: string;
    id: string;
    type: StickerType.GUILD;
    user_id: string;
};

export type CreateGuildStickerUploadOptions<TSticker> = {
    body: ModifyGuildStickerSchema;
    createSticker: (metadata: GuildStickerMetadata) => TSticker;
    file: StickerUploadFile;
    guild_id: string;
    id: string;
    saveSticker: (sticker: TSticker) => Promise<TSticker>;
    user_id: string;
    upload: UploadStickerFile;
    deleteUploadedFile: DeleteStickerFile;
};

export class UnsupportedStickerMimeTypeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsupportedStickerMimeTypeError";
    }
}

export function getStickerFormat(mime_type: string | undefined) {
    switch (mime_type) {
        case "image/apng":
            return StickerFormatType.APNG;
        case "application/json":
            return StickerFormatType.LOTTIE;
        case "image/png":
            return StickerFormatType.PNG;
        case "image/gif":
            return StickerFormatType.GIF;
        default:
            throw new UnsupportedStickerMimeTypeError("invalid sticker format: must be png, apng or lottie");
    }
}

export function buildGuildStickerMetadata({
    body,
    content_type,
    guild_id,
    id,
    user_id,
}: {
    body: ModifyGuildStickerSchema;
    content_type: string | undefined;
    guild_id: string;
    id: string;
    user_id: string;
}): GuildStickerMetadata {
    return {
        ...body,
        guild_id,
        id,
        type: StickerType.GUILD,
        format_type: getStickerFormat(content_type),
        available: true,
        user_id,
    };
}

export async function createGuildStickerUpload<TSticker>({
    body,
    createSticker,
    deleteUploadedFile,
    file,
    guild_id,
    id,
    saveSticker,
    upload,
    user_id,
}: CreateGuildStickerUploadOptions<TSticker>) {
    const uploadPath = `/stickers/${id}`;
    const uploadedFile = await upload(uploadPath, file);

    try {
        const sticker = createSticker(
            buildGuildStickerMetadata({
                body,
                content_type: uploadedFile.content_type ?? file.mimetype,
                guild_id,
                id,
                user_id,
            }),
        );

        return await saveSticker(sticker);
    } catch (error) {
        try {
            await deleteUploadedFile(uploadPath);
        } catch (cleanupError) {
            console.error("Failed to delete uploaded sticker after metadata save failure", cleanupError);
        }
        throw error;
    }
}

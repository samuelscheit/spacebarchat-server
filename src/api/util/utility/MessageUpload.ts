import multer from "multer";
import { Config, type MessageLimits } from "@spacebar/util";

export type MessageUploadLimitConfig = Pick<MessageLimits, "maxAttachmentSize">;
export type MessageUploadOptions = Partial<MessageUploadLimitConfig> & {
    fields?: number;
    files?: number;
};

export const MESSAGE_UPLOAD_FIELD_LIMIT = 10;

export function createMessageUpload(options: MessageUploadOptions = {}) {
    const limits: {
        fileSize: number;
        fields: number;
        files?: number;
    } = {
        fileSize: options.maxAttachmentSize ?? Config.get().limits.message.maxAttachmentSize,
        fields: options.fields ?? MESSAGE_UPLOAD_FIELD_LIMIT,
    };

    if (options.files !== undefined) limits.files = options.files;

    return multer({
        limits,
        storage: multer.memoryStorage(),
    });
}

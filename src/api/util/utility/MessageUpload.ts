import multer from "multer";
import { Config, type MessageLimits } from "@spacebar/util";

export type MessageUploadLimitConfig = Pick<MessageLimits, "maxAttachmentSize">;

export const MESSAGE_UPLOAD_FIELD_LIMIT = 10;

export function createMessageUpload(limits: MessageUploadLimitConfig = Config.get().limits.message) {
    return multer({
        limits: {
            fileSize: limits.maxAttachmentSize,
            fields: MESSAGE_UPLOAD_FIELD_LIMIT,
        },
        storage: multer.memoryStorage(),
    });
}

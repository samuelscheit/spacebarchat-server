import { Config } from "@spacebar/util";
import multer from "multer";

export type MessageUploadOptions = {
    fields?: number;
    files?: number;
};

export function createMessageUpload(options: MessageUploadOptions = {}) {
    const limits: {
        fileSize: number;
        fields: number;
        files?: number;
    } = {
        fileSize: Config.get().limits.message.maxAttachmentSize,
        fields: options.fields ?? 10,
    };

    if (options.files !== undefined) limits.files = options.files;

    return multer({
        limits,
        storage: multer.memoryStorage(),
    });
}

import { MessageCreateAttachment, MessageCreateCloudAttachment, MessageCreateFile } from "@spacebar/schemas";

export type MessageAttachmentMetadata = MessageCreateAttachment | MessageCreateCloudAttachment | MessageCreateFile;

export function isCloudMessageAttachment(attachment: MessageAttachmentMetadata): attachment is MessageCreateCloudAttachment {
    return "uploaded_filename" in attachment;
}

export function getAttachmentFilename(attachment: MessageAttachmentMetadata | undefined) {
    if (!attachment) return undefined;
    if ("name" in attachment && attachment.name) return attachment.name;
    if ("filename" in attachment && attachment.filename) return attachment.filename;
    if ("file" in attachment && attachment.file) return attachment.file.split(/[\\/]/).pop();
    return undefined;
}

export function normalizeMessageAttachmentInputs(attachments: (MessageCreateAttachment | MessageCreateCloudAttachment)[] | undefined, files: MessageCreateFile[] | undefined) {
    const metadata = [...(attachments ?? []), ...(files ?? [])];

    return {
        cloudAttachments: metadata.filter(isCloudMessageAttachment),
        uploadMetadata: metadata.filter((attachment) => !isCloudMessageAttachment(attachment)),
    };
}

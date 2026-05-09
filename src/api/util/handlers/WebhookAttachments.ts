import { MessageCreateAttachmentMetadata } from "@spacebar/schemas";

type WebhookBodyAttachment = MessageCreateAttachmentMetadata;

function isCloudAttachmentDescriptor(attachment: WebhookBodyAttachment): attachment is WebhookBodyAttachment & { uploaded_filename: string } {
    return "uploaded_filename" in attachment;
}

export function mergeWebhookMessageAttachments<TUploadedAttachment>(
    uploadedAttachments: TUploadedAttachment[],
    bodyAttachments?: WebhookBodyAttachment[],
): (TUploadedAttachment | WebhookBodyAttachment)[] {
    if (!bodyAttachments?.length) return uploadedAttachments;
    return [...uploadedAttachments, ...bodyAttachments.filter(isCloudAttachmentDescriptor)];
}

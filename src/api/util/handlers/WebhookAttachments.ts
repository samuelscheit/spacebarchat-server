import { MessageCreateAttachment, MessageCreateCloudAttachment } from "@spacebar/schemas";

type WebhookBodyAttachment = MessageCreateAttachment | MessageCreateCloudAttachment;

function isCloudAttachmentDescriptor(attachment: WebhookBodyAttachment): attachment is MessageCreateCloudAttachment {
    return "uploaded_filename" in attachment;
}

export function mergeWebhookMessageAttachments<TUploadedAttachment>(
    uploadedAttachments: TUploadedAttachment[],
    bodyAttachments?: WebhookBodyAttachment[],
): (TUploadedAttachment | WebhookBodyAttachment)[] {
    if (!bodyAttachments?.length) return uploadedAttachments;
    return [...uploadedAttachments, ...bodyAttachments.filter(isCloudAttachmentDescriptor)];
}

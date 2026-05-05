export type AttachmentStorageKeyParts = {
    channelId: string;
    messageId: string;
    filename: string;
};

export type LegacyAttachmentStorageKeyParts = {
    channelId: string;
    attachmentId: string;
    filename: string;
};

export const attachmentStoragePath = ({ channelId, messageId, filename }: AttachmentStorageKeyParts) => `attachments/${channelId}/${messageId}/${filename}`;

export const legacyAttachmentStoragePath = ({ channelId, attachmentId, filename }: LegacyAttachmentStorageKeyParts) => `attachments/${channelId}/${attachmentId}/${filename}`;

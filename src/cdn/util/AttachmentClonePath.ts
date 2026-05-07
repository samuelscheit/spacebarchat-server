export type AttachmentClonePathOptions = {
    sourceChannelId: string;
    destinationChannelId?: string;
    messageId: string;
    filename: string;
};

export function getAttachmentCloneDestinationPath({ sourceChannelId, destinationChannelId, messageId, filename }: AttachmentClonePathOptions): string {
    return `attachments/${destinationChannelId ?? sourceChannelId}/${messageId}/${filename}`;
}

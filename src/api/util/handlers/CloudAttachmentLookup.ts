import { HTTPError } from "lambert-server";

export type CloudAttachmentChannelLookup = {
    uploadFilename: string;
    channelId: string;
};

export type CloudAttachmentChannelRepository<TCloudAttachment> = {
    findOne(options: { where: CloudAttachmentChannelLookup }): Promise<TCloudAttachment | null>;
};

export function getCloudAttachmentChannelLookup(uploadedFilename: string, channelId: string): CloudAttachmentChannelLookup {
    return {
        uploadFilename: uploadedFilename,
        channelId: channelId,
    };
}

export function getCloudAttachmentLookupChannelId(destinationChannelId: string, uploadChannelId?: string): string {
    return uploadChannelId ?? destinationChannelId;
}

export async function findCloudAttachmentForChannel<TCloudAttachment>(
    repository: CloudAttachmentChannelRepository<TCloudAttachment>,
    uploadedFilename: string,
    channelId: string,
): Promise<TCloudAttachment> {
    const attachment = await repository.findOne({
        where: getCloudAttachmentChannelLookup(uploadedFilename, channelId),
    });

    if (!attachment) {
        throw new HTTPError("Attachment does not belong to this channel.", 400);
    }

    return attachment;
}

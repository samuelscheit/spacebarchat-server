import { HTTPError } from "lambert-server";

export type CloudAttachmentDestinationLookup = {
    uploadFilename: string;
    channelId: string;
};

export type CloudAttachmentDestinationRepository<TCloudAttachment> = {
    findOne(options: { where: CloudAttachmentDestinationLookup }): Promise<TCloudAttachment | null>;
};

export function getCloudAttachmentDestinationLookup(uploadedFilename: string, destinationChannelId: string): CloudAttachmentDestinationLookup {
    return {
        uploadFilename: uploadedFilename,
        channelId: destinationChannelId,
    };
}

export function getCloudAttachmentLookupChannelId(destinationChannelId: string, uploadChannelId?: string): string {
    return uploadChannelId ?? destinationChannelId;
}

export async function findCloudAttachmentForDestination<TCloudAttachment>(
    repository: CloudAttachmentDestinationRepository<TCloudAttachment>,
    uploadedFilename: string,
    destinationChannelId: string,
): Promise<TCloudAttachment> {
    const attachment = await repository.findOne({
        where: getCloudAttachmentDestinationLookup(uploadedFilename, destinationChannelId),
    });

    if (!attachment) {
        throw new HTTPError("Attachment does not belong to this channel.", 400);
    }

    return attachment;
}

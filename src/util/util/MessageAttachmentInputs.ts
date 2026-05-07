import { MessageCreateAttachment, MessageCreateCloudAttachment, MessageCreateFile } from "@spacebar/schemas";

export type MessageAttachmentUploadMetadata = MessageCreateAttachment | MessageCreateFile;
export type MessageAttachmentMetadata = MessageAttachmentUploadMetadata | MessageCreateCloudAttachment;

export type MessageAttachmentInput =
    | {
          type: "cloud";
          id?: string;
          metadata: MessageCreateCloudAttachment;
      }
    | {
          type: "upload";
          id?: string;
          metadata: MessageAttachmentUploadMetadata;
      };

export type MessageAttachmentUploadInput = Extract<MessageAttachmentInput, { type: "upload" }>;

export type MultipartUploadFile = {
    fieldname?: string;
    originalname: string;
};

export type CloudAttachmentAccessMetadata = {
    channelId?: string;
    userId?: string;
};

export function isCloudMessageAttachment(attachment: MessageAttachmentMetadata): attachment is MessageCreateCloudAttachment {
    return typeof (attachment as MessageCreateCloudAttachment).uploaded_filename === "string";
}

export function getAttachmentFilename(attachment: MessageAttachmentMetadata | undefined) {
    if (!attachment) return undefined;
    if ("name" in attachment && attachment.name) return attachment.name;
    if ("filename" in attachment && attachment.filename) return attachment.filename;
    if ("file" in attachment && attachment.file) return attachment.file.split(/[\\/]/).pop();
    return undefined;
}

export function normalizeMessageAttachmentInputs(attachments: (MessageCreateAttachment | MessageCreateCloudAttachment)[] | undefined, files: MessageCreateFile[] | undefined) {
    const fileMetadataById = new Map(files?.filter((file) => file.id !== undefined).map((file) => [file.id, file]) ?? []);
    const consumedFileMetadata = new Set<MessageCreateFile>();
    const inputs: MessageAttachmentInput[] = [];

    for (const attachment of attachments ?? []) {
        if (isCloudMessageAttachment(attachment)) {
            inputs.push({ type: "cloud", id: attachment.id, metadata: attachment });
            continue;
        }

        const fileMetadata = attachment.id !== undefined ? fileMetadataById.get(attachment.id) : undefined;
        if (fileMetadata) consumedFileMetadata.add(fileMetadata);

        inputs.push({
            type: "upload",
            id: attachment.id,
            metadata: fileMetadata ? { ...fileMetadata, ...attachment } : attachment,
        });
    }

    for (const file of files ?? []) {
        if (consumedFileMetadata.has(file)) continue;
        inputs.push({ type: "upload", id: file.id, metadata: file });
    }

    return inputs;
}

export function getMultipartUploadAttachmentId(file: Pick<MultipartUploadFile, "fieldname">) {
    if (!file.fieldname) return undefined;

    const match = /^(?:file|files)\[(\d+)\]$/.exec(file.fieldname);
    if (match) return match[1];

    if (file.fieldname === "file" || file.fieldname === "files") return "0";
    return undefined;
}

export function getUploadInputForMultipartFile(file: MultipartUploadFile, inputs: MessageAttachmentInput[], consumedInputs: Set<MessageAttachmentUploadInput>) {
    const uploadInputs = inputs.filter((input): input is MessageAttachmentUploadInput => input.type === "upload" && !consumedInputs.has(input));
    const multipartId = getMultipartUploadAttachmentId(file);

    if (multipartId !== undefined) {
        return uploadInputs.find((input) => input.id === multipartId);
    }

    return uploadInputs[0];
}

export function getCloudAttachmentAccessError(attachment: CloudAttachmentAccessMetadata, allowedChannelIds: string | string[], expectedUserId?: string) {
    const allowedChannels = Array.isArray(allowedChannelIds) ? allowedChannelIds : [allowedChannelIds];

    if (!attachment.channelId || !allowedChannels.includes(attachment.channelId)) {
        return { message: "Attachment does not belong to this channel", status: 400 };
    }

    if (expectedUserId && attachment.userId !== expectedUserId) {
        return { message: "You do not own this attachment", status: 403 };
    }

    return undefined;
}

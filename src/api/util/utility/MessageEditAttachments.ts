import type { MessageCreateAttachment, MessageCreateCloudAttachment } from "@spacebar/schemas";
import type { Attachment } from "@spacebar/util";
import { HTTPError } from "../../../util/util/lambert-server/HTTPError";

export type MessageEditAttachmentRequest = MessageCreateAttachment | MessageCreateCloudAttachment;
export type MessageEditResolvedAttachment = Attachment | MessageEditAttachmentRequest;
export type MessageEditAttachmentBody = {
    attachments?: readonly MessageEditAttachmentRequest[] | null;
};

export function isNewMessagePayloadAttachment(attachment: unknown): boolean {
    return typeof attachment === "object" && attachment !== null && "uploaded_filename" in attachment;
}

export function resolveMessageEditAttachments(
    existingAttachments: readonly Attachment[] = [],
    requestedAttachments?: readonly MessageEditAttachmentRequest[] | null,
): MessageEditResolvedAttachment[] | undefined {
    if (requestedAttachments === undefined) {
        return undefined;
    }

    if (requestedAttachments === null) {
        return [];
    }

    const existingAttachmentsById = new Map((existingAttachments ?? []).map((attachment) => [attachment.id, attachment]));
    return requestedAttachments.map((attachment) => {
        if (isNewMessagePayloadAttachment(attachment)) return attachment;
        if (!attachment.id) throw new HTTPError("Unknown attachment", 400);

        const retained = existingAttachmentsById.get(attachment.id);
        if (!retained) throw new HTTPError("Unknown attachment", 400);
        return retained;
    });
}

export function normalizeMessageEditBodyAttachments<T extends object>(
    body: T,
    existingAttachments: readonly Attachment[] = [],
): Omit<T, "attachments"> & { attachments?: MessageEditResolvedAttachment[] } {
    const { attachments: requestedAttachments, ...rest } = body as T & MessageEditAttachmentBody;
    const resolvedAttachments = resolveMessageEditAttachments(existingAttachments, requestedAttachments);

    if (resolvedAttachments === undefined) {
        return rest as Omit<T, "attachments"> & { attachments?: MessageEditResolvedAttachment[] };
    }

    return {
        ...rest,
        attachments: resolvedAttachments,
    } as Omit<T, "attachments"> & { attachments?: MessageEditResolvedAttachment[] };
}

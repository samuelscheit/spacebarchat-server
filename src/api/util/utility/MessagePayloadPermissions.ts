export interface MessagePayloadPermissionOptions {
    embed?: unknown | null;
    embeds?: readonly unknown[] | null;
    attachments?: readonly unknown[] | null;
    uploadedFileCount?: number;
}

export interface MessagePayloadPermissionChecker {
    hasThrow(permission: "EMBED_LINKS" | "ATTACH_FILES"): unknown;
}

export function isNewMessagePayloadAttachment(attachment: unknown): boolean {
    return typeof attachment === "object" && attachment !== null && "uploaded_filename" in attachment;
}

export function hasNewMessagePayloadAttachments(opts: MessagePayloadPermissionOptions): boolean {
    return (opts.uploadedFileCount ?? 0) > 0 || !!opts.attachments?.some(isNewMessagePayloadAttachment);
}

export function assertMessagePayloadPermissions(permission: MessagePayloadPermissionChecker, opts: MessagePayloadPermissionOptions): void {
    if (opts.embed != null || opts.embeds?.length) {
        permission.hasThrow("EMBED_LINKS");
    }

    if (hasNewMessagePayloadAttachments(opts)) {
        permission.hasThrow("ATTACH_FILES");
    }
}

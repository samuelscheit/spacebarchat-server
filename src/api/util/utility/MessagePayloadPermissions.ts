export interface MessagePayloadPermissionOptions {
    embed?: unknown | null;
    embeds?: readonly unknown[] | null;
    attachments?: readonly unknown[] | null;
    uploadedFileCount?: number;
}

export interface MessagePayloadPermissionChecker {
    hasThrow(permission: "EMBED_LINKS" | "ATTACH_FILES"): boolean;
}

export function assertMessagePayloadPermissions(permission: MessagePayloadPermissionChecker, opts: MessagePayloadPermissionOptions) {
    if (opts.embed || opts.embeds?.length) {
        permission.hasThrow("EMBED_LINKS");
    }

    if (opts.attachments?.length || opts.uploadedFileCount) {
        permission.hasThrow("ATTACH_FILES");
    }
}

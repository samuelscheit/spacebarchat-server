import { BaseMessageComponents, MessageComponentType, UnfurledMediaItem } from "@spacebar/schemas";
import { isNewMessagePayloadAttachment } from "./MessageEditAttachments";

export interface MessagePayloadPermissionOptions {
    embed?: unknown | null;
    embeds?: readonly unknown[] | null;
    attachments?: readonly unknown[] | null;
    components?: readonly BaseMessageComponents[] | null;
    uploadedFileCount?: number;
}

export interface MessagePayloadPermissionChecker {
    hasThrow(permission: "EMBED_LINKS" | "ATTACH_FILES"): unknown;
}

function collectMessageComponentMediaFromComponent(component: BaseMessageComponents, media: UnfurledMediaItem[]): void {
    switch (component.type) {
        case MessageComponentType.ActionRow:
        case MessageComponentType.TextDisplay:
        case MessageComponentType.Separator:
            break;
        case MessageComponentType.Section:
            if (component.accessory.type === MessageComponentType.Thumbnail) media.push(component.accessory.media);
            break;
        case MessageComponentType.MediaGallery:
            for (const item of component.items) media.push(item.media);
            break;
        case MessageComponentType.File:
            media.push(component.file);
            break;
        case MessageComponentType.Container:
            for (const child of component.components) collectMessageComponentMediaFromComponent(child, media);
            break;
        default:
            (component) satisfies never;
    }
}

export function collectMessageComponentMedia(components?: readonly BaseMessageComponents[] | null): UnfurledMediaItem[] {
    const media: UnfurledMediaItem[] = [];
    for (const component of components ?? []) collectMessageComponentMediaFromComponent(component, media);
    return media;
}

export function hasMessagePayloadComponentMedia(components?: readonly BaseMessageComponents[] | null): boolean {
    return collectMessageComponentMedia(components).length > 0;
}

export function hasNewMessagePayloadAttachments(opts: MessagePayloadPermissionOptions): boolean {
    return (opts.uploadedFileCount ?? 0) > 0 || !!opts.attachments?.some(isNewMessagePayloadAttachment) || hasMessagePayloadComponentMedia(opts.components);
}

export function hasMessagePayloadEmbeds(opts: MessagePayloadPermissionOptions): boolean {
    return opts.embed != null || !!opts.embeds?.length;
}

export function assertMessagePayloadPermissions(permission: MessagePayloadPermissionChecker, opts: MessagePayloadPermissionOptions): void {
    if (hasMessagePayloadEmbeds(opts)) {
        permission.hasThrow("EMBED_LINKS");
    }

    if (hasNewMessagePayloadAttachments(opts)) {
        permission.hasThrow("ATTACH_FILES");
    }
}

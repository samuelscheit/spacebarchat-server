import { Storage } from "./Storage";

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

export type AttachmentLookup = {
    id: string;
};

export type FindAttachment = (parts: AttachmentStorageKeyParts) => Promise<AttachmentLookup | null>;

export type AttachmentFileLookupOptions = AttachmentStorageKeyParts & {
    storage: Storage;
    findAttachment: FindAttachment;
    log?: (message: string) => void;
};

export type LegacyAttachmentMoveOptions = {
    storage: Storage;
    legacyPath: string;
    currentPath: string;
    log?: (message: string) => void;
};

export const moveLegacyAttachmentFile = async ({ storage, legacyPath, currentPath, log }: LegacyAttachmentMoveOptions) => {
    if (await storage.exists(currentPath)) return true;

    if (!(await storage.exists(legacyPath))) return storage.exists(currentPath);

    log?.(`[CDN/Attachments] Migrating legacy attachment path ${legacyPath} to ${currentPath}`);

    try {
        await storage.move(legacyPath, currentPath);
        return true;
    } catch (error) {
        if (await storage.exists(currentPath)) return true;
        throw error;
    }
};

export const getAttachmentFileFromStorage = async ({ storage, findAttachment, channelId, messageId, filename, log }: AttachmentFileLookupOptions) => {
    const currentPath = attachmentStoragePath({ channelId, messageId, filename });
    const file = await storage.get(currentPath);
    if (file) return file;

    const attachment = await findAttachment({ channelId, messageId, filename });
    if (!attachment) return null;

    const legacyPath = legacyAttachmentStoragePath({
        channelId,
        attachmentId: attachment.id,
        filename,
    });

    const migrated = await moveLegacyAttachmentFile({
        storage,
        legacyPath,
        currentPath,
        log,
    });

    if (!migrated) return null;
    return storage.get(currentPath);
};

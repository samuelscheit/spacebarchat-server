import { CdnConfiguration, CdnImageLimitsConfiguration } from "../config/types/CdnConfiguration";
import { DiscordApiErrors } from "./Constants";

const DEFAULT_JSON_BODY_LIMIT = 10 * 1024 * 1024;
const DATA_URI_BODY_OVERHEAD = 1024 * 1024;

function getConfiguredProfileImageSizeLimit(cdnConfig: CdnConfiguration): number {
    return Math.max(cdnConfig.limits.avatar.maxSize, cdnConfig.limits.banner.maxSize, cdnConfig.limits.guildAvatar.maxSize);
}

export function getCdnImageLimits(path: string, cdnConfig: CdnConfiguration): CdnImageLimitsConfiguration | undefined {
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/banners")) return cdnConfig.limits.banner;
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/avatars")) return cdnConfig.limits.guildAvatar;
    if (path.startsWith("/avatars/")) return cdnConfig.limits.avatar;
    if (path.startsWith("/banners/")) return cdnConfig.limits.banner;
    if (path.startsWith("/stickers/")) return cdnConfig.limits.sticker;
    return undefined;
}

export function getCdnFileSizeLimit(path: string, cdnConfig: CdnConfiguration): number | undefined {
    return getCdnImageLimits(path, cdnConfig)?.maxSize;
}

export function assertCdnFileSizeLimit(path: string, size: number, cdnConfig: CdnConfiguration) {
    const maxSize = getCdnFileSizeLimit(path, cdnConfig);
    if (maxSize !== undefined && size > maxSize) throw DiscordApiErrors.FILE_EXCEEDS_MAXIMUM_SIZE;
}

export function assertCdnAnimatedImagePolicy(path: string, mimeType: string, cdnConfig: CdnConfiguration) {
    const limits = getCdnImageLimits(path, cdnConfig);
    if (!limits || limits.allowAnimated !== "never") return;
    if (["image/apng", "image/gif", "image/gifv"].includes(mimeType)) throw DiscordApiErrors.INVALID_FILE_UPLOADED;
}

export function getConfiguredImageUploadBodyLimit(cdnConfig: CdnConfiguration): number {
    const maxImageSize = getConfiguredProfileImageSizeLimit(cdnConfig);
    const dataUriSize = Math.ceil((maxImageSize * 4) / 3) + DATA_URI_BODY_OVERHEAD;

    return Math.max(DEFAULT_JSON_BODY_LIMIT, dataUriSize);
}

export function getConfiguredCdnMultipartFileLimit(cdnConfig: CdnConfiguration): number {
    return Math.max(cdnConfig.maxAttachmentSize, getConfiguredProfileImageSizeLimit(cdnConfig));
}

import { CdnConfiguration } from "../config/types/CdnConfiguration";
import { DiscordApiErrors } from "./Constants";

const DEFAULT_JSON_BODY_LIMIT = 10 * 1024 * 1024;
const DATA_URI_BODY_OVERHEAD = 1024 * 1024;

function getConfiguredProfileImageSizeLimit(cdnConfig: CdnConfiguration): number {
    return Math.max(cdnConfig.limits.avatar.maxSize, cdnConfig.limits.banner.maxSize, cdnConfig.limits.guildAvatar.maxSize);
}

function getCdnImageLimits(path: string, cdnConfig: CdnConfiguration) {
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/banners")) return cdnConfig.limits.banner;
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/avatars")) return cdnConfig.limits.guildAvatar;
    if (path.startsWith("/avatars/")) return cdnConfig.limits.avatar;
    if (path.startsWith("/banners/")) return cdnConfig.limits.banner;
    return undefined;
}

export function getCdnFileSizeLimit(path: string, cdnConfig: CdnConfiguration): number | undefined {
    return getCdnImageLimits(path, cdnConfig)?.maxSize;
}

export function assertCdnFileSizeLimit(path: string, size: number, cdnConfig: CdnConfiguration) {
    const maxSize = getCdnFileSizeLimit(path, cdnConfig);
    if (maxSize !== undefined && size > maxSize) throw DiscordApiErrors.FILE_EXCEEDS_MAXIMUM_SIZE;
}

export function isCdnAnimatedImageAllowed(path: string, cdnConfig: CdnConfiguration, hasPremium: boolean = false): boolean {
    const allowAnimated = getCdnImageLimits(path, cdnConfig)?.allowAnimated;
    if (allowAnimated === "never") return false;
    if (allowAnimated === "premium") return hasPremium;
    return true;
}

export function assertCdnAnimatedImageAllowed(path: string, isAnimated: boolean, cdnConfig: CdnConfiguration, hasPremium: boolean = false) {
    if (isAnimated && !isCdnAnimatedImageAllowed(path, cdnConfig, hasPremium)) throw DiscordApiErrors.INVALID_FORM_BODY;
}

export function getConfiguredImageUploadBodyLimit(cdnConfig: CdnConfiguration): number {
    const maxImageSize = getConfiguredProfileImageSizeLimit(cdnConfig);
    const dataUriSize = Math.ceil((maxImageSize * 4) / 3) + DATA_URI_BODY_OVERHEAD;

    return Math.max(DEFAULT_JSON_BODY_LIMIT, dataUriSize);
}

export function getConfiguredCdnMultipartFileLimit(cdnConfig: CdnConfiguration): number {
    return Math.max(cdnConfig.maxAttachmentSize, getConfiguredProfileImageSizeLimit(cdnConfig));
}

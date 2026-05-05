import { CdnConfiguration } from "../config/types/CdnConfiguration";
import { DiscordApiErrors } from "./Constants";

const DEFAULT_JSON_BODY_LIMIT = 10 * 1024 * 1024;
const DATA_URI_BODY_OVERHEAD = 1024 * 1024;

export function getCdnFileSizeLimit(path: string, cdnConfig: CdnConfiguration): number | undefined {
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/banners")) return cdnConfig.limits.banner.maxSize;
    if (path.startsWith("/guilds/") && path.includes("/users/") && path.includes("/avatars")) return cdnConfig.limits.guildAvatar.maxSize;
    if (path.startsWith("/avatars/")) return cdnConfig.limits.avatar.maxSize;
    if (path.startsWith("/banners/")) return cdnConfig.limits.banner.maxSize;
    return undefined;
}

export function assertCdnFileSizeLimit(path: string, size: number, cdnConfig: CdnConfiguration) {
    const maxSize = getCdnFileSizeLimit(path, cdnConfig);
    if (maxSize !== undefined && size > maxSize) throw DiscordApiErrors.FILE_EXCEEDS_MAXIMUM_SIZE;
}

export function getConfiguredImageUploadBodyLimit(cdnConfig: CdnConfiguration): number {
    const maxImageSize = Math.max(cdnConfig.limits.avatar.maxSize, cdnConfig.limits.banner.maxSize, cdnConfig.limits.guildAvatar.maxSize);
    const dataUriSize = Math.ceil((maxImageSize * 4) / 3) + DATA_URI_BODY_OVERHEAD;

    return Math.max(DEFAULT_JSON_BODY_LIMIT, dataUriSize);
}

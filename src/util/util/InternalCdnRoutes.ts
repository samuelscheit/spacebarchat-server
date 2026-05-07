import { SPACEBAR_CDN_INTERNAL_PATH } from "./CdnRoutes";

function trimTrailingSlash(value: string) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function ensureLeadingSlash(value: string) {
    return value.startsWith("/") ? value : `/${value}`;
}

export function getInternalCdnPath(path: string) {
    return `${SPACEBAR_CDN_INTERNAL_PATH}${ensureLeadingSlash(path)}`;
}

export function getInternalCdnUrl(cdnEndpoint: string, path: string) {
    return `${trimTrailingSlash(cdnEndpoint)}${getInternalCdnPath(path)}`;
}

export function shouldUseInternalCdnPath(path: string) {
    return ensureLeadingSlash(path).startsWith("/attachments/");
}

export function getCdnMutationUrl(cdnEndpoint: string, path: string) {
    const normalizedPath = shouldUseInternalCdnPath(path) ? getInternalCdnPath(path) : ensureLeadingSlash(path);

    return `${trimTrailingSlash(cdnEndpoint)}${normalizedPath}`;
}

export function getAttachmentMutationPath(uploadFilename: string) {
    return `/attachments/${uploadFilename}`;
}

export function getAttachmentCloneMutationPath(uploadFilename: string, messageId: string) {
    return `${getAttachmentMutationPath(uploadFilename)}/clone_to_message/${messageId}`;
}

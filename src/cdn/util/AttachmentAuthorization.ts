import { timingSafeEqual } from "node:crypto";

export type AttachmentUrlSignature = {
    path: string;
    hash: string;
    issuedAt: string;
    expiresAt: string;
};

export type AttachmentSignatureRequest = {
    ip?: string;
    userAgent?: string;
};

export type AttachmentSignatureValidator = (request: AttachmentSignatureRequest, signature: AttachmentUrlSignature) => boolean;

export type AttachmentRequestAuthorizationOptions = {
    signatureHeader: string | string[] | undefined;
    requestSignature: string;
    cdnSignUrls: boolean;
    fullUrl: string;
    ip?: string;
    userAgent?: string;
    validateSignature?: AttachmentSignatureValidator;
    warn?: (message: string) => void;
};

export const hasMatchingRequestSignature = (signatureHeader: string | string[] | undefined, requestSignature: string) => {
    if (typeof signatureHeader !== "string" || requestSignature.length === 0) return false;

    const received = Buffer.from(signatureHeader);
    const expected = Buffer.from(requestSignature);

    return received.length === expected.length && timingSafeEqual(received, expected);
};

export const parseAttachmentUrlSignature = (fullUrl: string): AttachmentUrlSignature => {
    const url = new URL(fullUrl);
    const expiresAt = url.searchParams.get("ex");
    const issuedAt = url.searchParams.get("is");
    const hash = url.searchParams.get("hm");

    if (!expiresAt || !issuedAt || !hash) throw new Error("Invalid URL signature parameters");

    return {
        path: url.pathname,
        hash,
        issuedAt,
        expiresAt,
    };
};

export const hasValidAttachmentRequestAuthorization = ({
    signatureHeader,
    requestSignature,
    cdnSignUrls,
    fullUrl,
    ip,
    userAgent,
    validateSignature,
    warn,
}: AttachmentRequestAuthorizationOptions) => {
    if (hasMatchingRequestSignature(signatureHeader, requestSignature)) return true;

    if (!cdnSignUrls) return true;

    if (!validateSignature) {
        warn?.(signatureHeader !== undefined ? "[CDN/Attachments] Client sent invalid signature header" : "[CDN/Attachments] Client sent invalid attachment URL signature");
        return false;
    }

    try {
        const isValid = validateSignature(
            {
                ip,
                userAgent,
            },
            parseAttachmentUrlSignature(fullUrl),
        );
        if (!isValid)
            warn?.(signatureHeader !== undefined ? "[CDN/Attachments] Client sent invalid signature header" : "[CDN/Attachments] Client sent invalid attachment URL signature");
        return isValid;
    } catch {
        warn?.(signatureHeader !== undefined ? "[CDN/Attachments] Client sent invalid signature header" : "[CDN/Attachments] Client sent invalid attachment URL signature");
        return false;
    }
};

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
    if (signatureHeader !== undefined) {
        const isValid = typeof signatureHeader === "string" && signatureHeader === requestSignature;
        if (!isValid) warn?.("[CDN/Attachments] Client sent invalid signature header");
        return isValid;
    }

    if (!cdnSignUrls) return true;

    if (!validateSignature) {
        warn?.("[CDN/Attachments] Client sent invalid attachment URL signature");
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
        if (!isValid) warn?.("[CDN/Attachments] Client sent invalid attachment URL signature");
        return isValid;
    } catch {
        warn?.("[CDN/Attachments] Client sent invalid attachment URL signature");
        return false;
    }
};

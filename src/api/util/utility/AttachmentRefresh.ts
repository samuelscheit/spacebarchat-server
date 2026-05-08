import type { RefreshedUrl } from "@spacebar/schemas";

export interface AttachmentUrlSignatureInput {
    ip?: string;
    url: string;
    userAgent?: string;
}

export interface AttachmentUrlSignResult {
    applyToUrl(url: URL | string): URL;
}

export type AttachmentUrlSigner = (data: AttachmentUrlSignatureInput) => AttachmentUrlSignResult;
export type AttachmentRefreshFetch = typeof fetch;

export interface LocalAttachmentUrlParts {
    channelId: string;
    filename: string;
    messageId: string;
}

export type LocalAttachmentAuthorizer = (url: string, attachment: LocalAttachmentUrlParts) => Promise<void> | void;

export interface RefreshAttachmentUrlsOptions {
    attachmentUrls: string[];
    authorizeLocalAttachmentUrl?: LocalAttachmentAuthorizer;
    discordBotToken?: string | null;
    fetcher?: AttachmentRefreshFetch;
    ip?: string;
    localCdnEndpoint?: string | null;
    signer: AttachmentUrlSigner;
    userAgent?: string;
}

export class AttachmentRefreshError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly publicMessage: string,
    ) {
        super(publicMessage);
    }
}

const discordAttachmentHosts = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const discordRefreshEndpoint = "https://discord.com/api/v9/attachments/refresh-urls";
const discordAttachmentPathPattern = /^\/(?:attachments|ephemeral-attachments)\/([^/]+)\/([^/]+)\/([^/]+)$/;
const localAttachmentPathPattern = /^\/attachments\/([^/]+)\/([^/]+)\/([^/]+)$/;
const snowflakePattern = /^\d+$/;

function decodePathSegment(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return null;
    }
}

function parseAttachmentPath(pathname: string, pattern: RegExp): LocalAttachmentUrlParts | null {
    const match = pathname.match(pattern);
    if (!match) return null;

    const [channelId, messageId, filename] = match.slice(1).map(decodePathSegment);
    if (!channelId || !messageId || !filename) return null;
    if (!snowflakePattern.test(channelId) || !snowflakePattern.test(messageId)) return null;
    if (filename.includes("/")) return null;

    return { channelId, messageId, filename };
}

export function parseDiscordAttachmentUrl(url: string) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "https:") return null;
        if (!discordAttachmentHosts.has(parsedUrl.hostname)) return null;
        if (!parseAttachmentPath(parsedUrl.pathname, discordAttachmentPathPattern)) return null;

        return parsedUrl;
    } catch {
        return null;
    }
}

export function isDiscordAttachmentUrl(url: string) {
    return parseDiscordAttachmentUrl(url) !== null;
}

export function parseLocalAttachmentUrl(url: string, localCdnEndpoint: string | null | undefined): LocalAttachmentUrlParts | null {
    if (!localCdnEndpoint) return null;

    try {
        const parsedUrl = new URL(url);
        const parsedLocalCdnEndpoint = new URL(localCdnEndpoint);

        if (parsedUrl.origin !== parsedLocalCdnEndpoint.origin) return null;

        return parseAttachmentPath(parsedUrl.pathname, localAttachmentPathPattern);
    } catch {
        return null;
    }
}

export function isLocalAttachmentUrl(url: string, localCdnEndpoint: string | null | undefined) {
    return parseLocalAttachmentUrl(url, localCdnEndpoint) !== null;
}

function getDiscordAuthorizationHeader(discordBotToken: string) {
    return discordBotToken.startsWith("Bot ") ? discordBotToken : `Bot ${discordBotToken}`;
}

async function refreshDiscordAttachmentUrls(attachmentUrls: string[], discordBotToken: string, fetcher: AttachmentRefreshFetch) {
    const response = await fetcher(discordRefreshEndpoint, {
        method: "POST",
        headers: {
            authorization: getDiscordAuthorizationHeader(discordBotToken),
            "content-type": "application/json",
        },
        body: JSON.stringify({
            attachment_urls: attachmentUrls,
        }),
    });

    if (!response.ok) throw new AttachmentRefreshError(502, "Discord attachment URL refresh failed");

    let body: { refreshed_urls?: RefreshedUrl[] };
    try {
        body = (await response.json()) as { refreshed_urls?: RefreshedUrl[] };
    } catch {
        throw new AttachmentRefreshError(502, "Discord attachment URL refresh returned an invalid response");
    }

    if (!Array.isArray(body.refreshed_urls)) {
        throw new AttachmentRefreshError(502, "Discord attachment URL refresh returned an invalid response");
    }

    const requestedUrls = new Set(attachmentUrls);
    const refreshedUrls = new Map<string, string>();
    for (const refreshedUrl of body.refreshed_urls) {
        if (!refreshedUrl || typeof refreshedUrl.original !== "string" || typeof refreshedUrl.refreshed !== "string") {
            throw new AttachmentRefreshError(502, "Discord attachment URL refresh returned an invalid response");
        }

        if (!requestedUrls.has(refreshedUrl.original)) continue;
        if (!isDiscordAttachmentUrl(refreshedUrl.original) || !isDiscordAttachmentUrl(refreshedUrl.refreshed)) {
            throw new AttachmentRefreshError(502, "Discord attachment URL refresh returned an invalid response");
        }

        refreshedUrls.set(refreshedUrl.original, refreshedUrl.refreshed);
    }

    return attachmentUrls.map((url) => ({
        original: url,
        refreshed: refreshedUrls.get(url) ?? url,
    }));
}

export async function refreshAttachmentUrls({
    attachmentUrls,
    authorizeLocalAttachmentUrl,
    discordBotToken,
    fetcher = fetch,
    ip,
    localCdnEndpoint,
    signer,
    userAgent,
}: RefreshAttachmentUrlsOptions): Promise<RefreshedUrl[]> {
    const classifiedUrls = await Promise.all(
        attachmentUrls.map(async (url) => {
            if (isDiscordAttachmentUrl(url)) return { type: "discord" as const, url };

            const localAttachmentUrl = parseLocalAttachmentUrl(url, localCdnEndpoint);
            if (localAttachmentUrl) {
                if (!authorizeLocalAttachmentUrl) throw new AttachmentRefreshError(503, "Local attachment URL refresh is not configured");
                await authorizeLocalAttachmentUrl?.(url, localAttachmentUrl);
                return { type: "local" as const, attachment: localAttachmentUrl, url };
            }

            throw new AttachmentRefreshError(400, "Only Spacebar attachment URLs and Discord attachment URLs can be refreshed");
        }),
    );

    const discordUrls = classifiedUrls.filter((classifiedUrl) => classifiedUrl.type === "discord").map((classifiedUrl) => classifiedUrl.url);
    if (discordUrls.length && !discordBotToken) throw new AttachmentRefreshError(503, "Discord attachment URL refresh is not configured");

    const discordRefreshes = discordUrls.length ? await refreshDiscordAttachmentUrls(discordUrls, discordBotToken!, fetcher) : [];
    const discordRefreshByOriginal = new Map(discordRefreshes.map((url) => [url.original, url.refreshed]));

    return classifiedUrls.map((classifiedUrl) => {
        if (classifiedUrl.type === "discord") {
            return {
                original: classifiedUrl.url,
                refreshed: discordRefreshByOriginal.get(classifiedUrl.url) ?? classifiedUrl.url,
            };
        }

        return {
            original: classifiedUrl.url,
            refreshed: signer({
                url: classifiedUrl.url,
                ip,
                userAgent,
            })
                .applyToUrl(classifiedUrl.url)
                .toString(),
        };
    });
}

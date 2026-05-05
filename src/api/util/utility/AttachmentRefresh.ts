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

export interface RefreshAttachmentUrlsOptions {
    attachmentUrls: string[];
    discordBotToken?: string | null;
    fetcher?: AttachmentRefreshFetch;
    ip?: string;
    localCdnEndpoint?: string | null;
    signer: AttachmentUrlSigner;
    userAgent?: string;
}

const discordAttachmentHosts = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const discordRefreshEndpoint = "https://discord.com/api/v9/attachments/refresh-urls";

export function isDiscordAttachmentUrl(url: string) {
    try {
        return discordAttachmentHosts.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

export function isLocalAttachmentUrl(url: string, localCdnEndpoint: string | null | undefined) {
    if (!localCdnEndpoint) return false;

    try {
        const parsedUrl = new URL(url);
        const parsedLocalCdnEndpoint = new URL(localCdnEndpoint);

        return parsedUrl.origin === parsedLocalCdnEndpoint.origin && parsedUrl.pathname.startsWith("/attachments/");
    } catch {
        return false;
    }
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

    if (!response.ok) throw new Error(`Discord attachment URL refresh failed with status ${response.status}`);

    const body = (await response.json()) as { refreshed_urls?: RefreshedUrl[] };
    const refreshedUrls = new Map((body.refreshed_urls ?? []).map((url) => [url.original, url.refreshed]));

    return attachmentUrls.map((url) => ({
        original: url,
        refreshed: refreshedUrls.get(url) ?? url,
    }));
}

export async function refreshAttachmentUrls({
    attachmentUrls,
    discordBotToken,
    fetcher = fetch,
    ip,
    localCdnEndpoint,
    signer,
    userAgent,
}: RefreshAttachmentUrlsOptions): Promise<RefreshedUrl[]> {
    const discordUrls = attachmentUrls.filter(isDiscordAttachmentUrl);
    if (discordUrls.length && !discordBotToken) throw new Error("Discord attachment URL refresh requires external.discordAttachmentRefreshBotToken");

    const discordRefreshes = discordUrls.length ? await refreshDiscordAttachmentUrls(discordUrls, discordBotToken!, fetcher) : [];
    const discordRefreshByOriginal = new Map(discordRefreshes.map((url) => [url.original, url.refreshed]));

    return attachmentUrls.map((url) => {
        if (discordRefreshByOriginal.has(url)) {
            return {
                original: url,
                refreshed: discordRefreshByOriginal.get(url)!,
            };
        }

        if (!isLocalAttachmentUrl(url, localCdnEndpoint)) throw new Error("Only Spacebar attachment URLs and Discord attachment URLs can be refreshed");

        return {
            original: url,
            refreshed: signer({
                url,
                ip,
                userAgent,
            })
                .applyToUrl(url)
                .toString(),
        };
    });
}

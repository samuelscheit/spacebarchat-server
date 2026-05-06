import { normalizeUrl } from "../../../util/util/Url";

const LINK_REGEX = /<?https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)>?/g;

export function getMessageContentUrls(content: string | undefined | null) {
    const strippedContent = content?.replace(/ *`[^)]*` */g, "");

    return strippedContent?.match(LINK_REGEX) ?? [];
}

export function selectLinkEmbedUrls(content: string | undefined | null, maxLinkEmbeds: number) {
    const limit = Math.max(0, Math.floor(maxLinkEmbeds));
    if (limit === 0) return [];

    const urls: string[] = [];
    const seenNormalizedUrls = new Set<string>();

    for (const url of getMessageContentUrls(content)) {
        if (url.startsWith("<") || url.endsWith(">")) continue;

        const normalizedUrl = normalizeUrl(url);
        if (seenNormalizedUrls.has(normalizedUrl)) continue;

        seenNormalizedUrls.add(normalizedUrl);
        urls.push(url);

        if (urls.length >= limit) break;
    }

    return urls;
}

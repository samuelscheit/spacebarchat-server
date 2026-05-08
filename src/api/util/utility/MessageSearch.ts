import type { Message } from "@spacebar/util";

export function messageToSearchResult(message: Message) {
    return message.toSearchResult();
}

export function parseIncludeNsfwSearchParam(includeNsfw: string | undefined) {
    return includeNsfw === "true";
}

export function getSearchChannelNsfwFilter(includeNsfw: string | undefined) {
    return parseIncludeNsfwSearchParam(includeNsfw) ? {} : { channel: { nsfw: false } };
}

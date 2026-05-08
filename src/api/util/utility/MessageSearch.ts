import type { Message } from "@spacebar/util";

export function messageToSearchResult(message: Message) {
    return message.toSearchResult();
}

export function parseIncludeNsfwSearchParam(includeNsfw: unknown) {
    return includeNsfw === "true";
}

export function getSearchChannelNsfwFilter(includeNsfw: unknown) {
    return parseIncludeNsfwSearchParam(includeNsfw) ? {} : { channel: { nsfw: false } };
}

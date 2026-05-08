import { FieldErrors, type Message } from "@spacebar/util";

export function messageToSearchResult(message: Message) {
    return message.toSearchResult();
}

const MESSAGE_SEARCH_SORT_BY_CHOICES = ["timestamp"] as const;

export type MessageSearchSortBy = (typeof MESSAGE_SEARCH_SORT_BY_CHOICES)[number];

export function parseMessageSearchSortBy(sortBy: unknown): MessageSearchSortBy {
    if (sortBy === undefined) return "timestamp";

    if (typeof sortBy === "string" && MESSAGE_SEARCH_SORT_BY_CHOICES.includes(sortBy as MessageSearchSortBy)) return sortBy as MessageSearchSortBy;

    throw FieldErrors({
        sort_by: {
            message: "Value must be one of ('timestamp').",
            code: "BASE_TYPE_CHOICES",
        },
    });
}

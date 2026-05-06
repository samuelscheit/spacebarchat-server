import type { Message } from "@spacebar/util";

export function messageToSearchResult(message: Message) {
    const publicMessage = message.toJSON();

    return {
        ...publicMessage,
        mention_roles: message.mention_roles ?? [],
        hit: true as const,
    };
}

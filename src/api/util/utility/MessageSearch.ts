import type { Message } from "@spacebar/util";

export function messageToSearchResult(message: Message) {
    return message.toSearchResult();
}

import { Reaction } from "@spacebar/schemas";

export function preserveEditedMessageReactions(existing: Reaction[] | null | undefined, incoming: Reaction[] | null | undefined) {
    return incoming ?? existing ?? [];
}

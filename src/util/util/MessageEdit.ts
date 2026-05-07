import type { MessageCreateSchema, StoredReaction } from "@spacebar/schemas";

type MessageEditSource = {
    author_id?: string;
    message_reference?: MessageCreateSchema["message_reference"];
    reactions?: StoredReaction[] | null;
};

export type MessageEditHandleMessageOptions<T extends MessageEditSource = MessageEditSource, B extends object = object, E extends object = object> = T &
    B &
    E & {
        author_id?: string;
        channel_id: string;
        id: string;
        reactions: StoredReaction[];
        edited_timestamp: Date;
        message_reference?: MessageCreateSchema["message_reference"];
    };

export function preserveEditedMessageReactions(existing: StoredReaction[] | null | undefined): StoredReaction[] {
    return existing ?? [];
}

export function buildMessageEditHandleMessageOptions<T extends MessageEditSource, B extends object, E extends object = object>(
    message: T,
    body: B,
    channelId: string,
    messageId: string,
    editedTimestamp = new Date(),
    extraOptions?: E,
): MessageEditHandleMessageOptions<T, B, E> {
    return {
        ...message,
        // TODO: should message_reference be overridable?
        message_reference: message.message_reference,
        ...body,
        ...(extraOptions ?? ({} as E)),
        author_id: message.author_id,
        channel_id: channelId,
        id: messageId,
        reactions: preserveEditedMessageReactions(message.reactions),
        edited_timestamp: editedTimestamp,
    } as MessageEditHandleMessageOptions<T, B, E>;
}

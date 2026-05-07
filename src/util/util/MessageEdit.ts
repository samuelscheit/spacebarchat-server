import type { MessageCreateSchema, MessageEditSchema, Reaction } from "@spacebar/schemas";

type MessageEditSource = {
    author_id?: string;
    message_reference?: MessageCreateSchema["message_reference"];
    reactions?: Reaction[] | null;
};

export type MessageEditHandleMessageOptions<T extends MessageEditSource = MessageEditSource> = T &
    MessageEditSchema & {
        author_id?: string;
        channel_id: string;
        id: string;
        reactions: Reaction[];
        edited_timestamp: Date;
        message_reference?: MessageCreateSchema["message_reference"];
    };

export function preserveEditedMessageReactions(existing: Reaction[] | null | undefined): Reaction[] {
    return existing ?? [];
}

export function buildMessageEditHandleMessageOptions<T extends MessageEditSource>(
    message: T,
    body: MessageEditSchema,
    channelId: string,
    messageId: string,
    editedTimestamp = new Date(),
): MessageEditHandleMessageOptions<T> {
    return {
        ...message,
        // TODO: should message_reference be overridable?
        message_reference: message.message_reference,
        ...body,
        author_id: message.author_id,
        channel_id: channelId,
        id: messageId,
        reactions: preserveEditedMessageReactions(message.reactions),
        edited_timestamp: editedTimestamp,
    } as MessageEditHandleMessageOptions<T>;
}

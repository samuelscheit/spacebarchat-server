import type { MessageAcknowledgeSchema } from "@spacebar/schemas";

export interface AcknowledgeableReadState {
    last_message_id?: string | null;
    mention_count?: number;
    notifications_cursor?: string | null;
    last_viewed?: number | null;
    flags?: number | null;
}

export function advanceNotificationCursor(readState: AcknowledgeableReadState, messageId: string) {
    if (!readState.notifications_cursor || BigInt(messageId) > BigInt(readState.notifications_cursor)) {
        readState.notifications_cursor = messageId;
    }

    return readState;
}

export function applyChannelMessageReadStateUpdate(readState: AcknowledgeableReadState, messageId: string) {
    readState.last_message_id = messageId;
    readState.mention_count = 0;
    advanceNotificationCursor(readState, messageId);

    return readState;
}

export function applyMessageAcknowledgeToReadState(readState: AcknowledgeableReadState, messageId: string, body: MessageAcknowledgeSchema) {
    applyChannelMessageReadStateUpdate(readState, messageId);
    readState.last_viewed = body.last_viewed ?? readState.last_viewed ?? 0;
    readState.flags = body.flags ?? readState.flags ?? 0;

    return readState;
}

import type { MessageAcknowledgeSchema } from "@spacebar/schemas";

export interface AcknowledgeableReadState {
    last_message_id?: string | null;
    mention_count?: number;
    notifications_cursor?: string | null;
    last_viewed?: number | null;
    flags?: number | null;
}

function maxSnowflakeId(...ids: (string | null | undefined)[]) {
    let max: string | undefined;

    for (const id of ids) {
        if (id === null || id === undefined) continue;
        if (max === undefined || BigInt(id) > BigInt(max)) max = id;
    }

    return max;
}

export function advanceNotificationCursor(readState: AcknowledgeableReadState, messageId: string) {
    readState.notifications_cursor = maxSnowflakeId(readState.notifications_cursor, readState.last_message_id, messageId);

    return readState;
}

export function applyChannelMessageReadStateUpdate(readState: AcknowledgeableReadState, messageId: string) {
    advanceNotificationCursor(readState, messageId);
    readState.last_message_id = messageId;
    readState.mention_count = 0;

    return readState;
}

export function applyMessageAcknowledgeToReadState(readState: AcknowledgeableReadState, messageId: string, body: MessageAcknowledgeSchema) {
    applyChannelMessageReadStateUpdate(readState, messageId);
    readState.last_viewed = body.last_viewed ?? readState.last_viewed ?? 0;
    readState.flags = body.flags ?? readState.flags ?? 0;

    return readState;
}

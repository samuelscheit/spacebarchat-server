export const READY_READ_STATE_DEFAULT_LAST_PIN_TIMESTAMP = "1970-01-01T00:00:00+00:00";
const READY_CHANNEL_READ_STATE_TYPE = 0;

export interface ReadyReadStateInput {
    id?: string;
    channel_id: string;
    mention_count?: number;
    badge_count?: number;
    last_message_id?: string | null;
    last_acked_id?: string | null;
    notifications_cursor?: string | null;
    last_pin_timestamp?: Date | string | null;
    last_viewed?: number | null;
    read_state_type?: number;
    flags?: number;
}

export interface ReadyChannelReadStatePayload {
    id: string;
    mention_count: number;
    last_viewed: number;
    last_message_id?: string | null;
    notifications_cursor?: string | null;
    last_pin_timestamp: Date | string;
    flags: number;
}

export interface ReadyNonChannelReadStatePayload {
    id: string;
    read_state_type: number;
    badge_count: number;
    last_viewed: number;
    last_acked_id?: string | null;
}

export type ReadyReadStatePayload = ReadyChannelReadStatePayload | ReadyNonChannelReadStatePayload;

export function serializeReadyReadState(readStates: ReadyReadStateInput[], includeNonChannelReadStates = true): ReadyReadStatePayload[] {
    const payloads: ReadyReadStatePayload[] = [];

    for (const readState of readStates) {
        const readStateType = readState.read_state_type ?? READY_CHANNEL_READ_STATE_TYPE;
        if (readStateType !== READY_CHANNEL_READ_STATE_TYPE) {
            if (!includeNonChannelReadStates) continue;

            const payload: ReadyNonChannelReadStatePayload = {
                id: readState.channel_id,
                read_state_type: readStateType,
                badge_count: readState.badge_count ?? 0,
                last_viewed: readState.last_viewed ?? 0,
            };

            if (readState.last_acked_id !== null && readState.last_acked_id !== undefined) payload.last_acked_id = readState.last_acked_id;

            payloads.push(payload);
            continue;
        }

        const payload: ReadyChannelReadStatePayload = {
            id: readState.channel_id,
            mention_count: readState.mention_count ?? 0,
            last_viewed: readState.last_viewed ?? 0,
            last_pin_timestamp: readState.last_pin_timestamp ?? READY_READ_STATE_DEFAULT_LAST_PIN_TIMESTAMP,
            flags: readState.flags ?? 0,
        };

        if (readState.last_message_id !== null && readState.last_message_id !== undefined) payload.last_message_id = readState.last_message_id;
        if (readState.notifications_cursor !== null && readState.notifications_cursor !== undefined) payload.notifications_cursor = readState.notifications_cursor;

        payloads.push(payload);
    }

    return payloads;
}

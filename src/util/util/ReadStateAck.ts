import type { MessageAcknowledgeSchema } from "@spacebar/schemas";
import { Raw, type FindOperator } from "typeorm";

export interface AcknowledgeableReadState {
    last_message_id?: string | null;
    mention_count?: number;
    last_viewed?: number | null;
    flags?: number | null;
}

export interface AdvanceOnlyNotificationCursorCondition {
    id: string;
    notifications_cursor: FindOperator<string>;
}

export function advanceOnlyNotificationCursorSql(alias: string): string {
    return `(${alias} IS NULL OR CAST(${alias} AS bigint) < CAST(:messageId AS bigint))`;
}

export function shouldAdvanceNotificationCursor(current: string | null | undefined, next: string): boolean {
    return current === null || current === undefined || BigInt(next) > BigInt(current);
}

export function getAdvanceOnlyNotificationCursorCondition(readStateId: string, messageId: string): AdvanceOnlyNotificationCursorCondition {
    return {
        id: readStateId,
        notifications_cursor: Raw(advanceOnlyNotificationCursorSql, { messageId }),
    };
}

export function applyMessageAcknowledgeToReadState(readState: AcknowledgeableReadState, messageId: string, body: MessageAcknowledgeSchema) {
    readState.last_message_id = messageId;
    readState.mention_count = 0;
    readState.last_viewed = body.last_viewed ?? readState.last_viewed ?? 0;
    readState.flags = body.flags ?? readState.flags ?? 0;
    return readState;
}

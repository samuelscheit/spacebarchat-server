import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { ReadStateType, type AckBulkSchema, type MessageAcknowledgeSchema } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { ReadState } from "../entities/ReadState";
import { DatabaseType } from "./Database";
import { applyAckBulkReadStateUpdate, getReadStateIdentity } from "./ReadState";

export interface ChannelMessageReadStateIdentity {
    user_id: string;
    channel_id: string;
}

type ChannelMessageReadStateOptions = Pick<MessageAcknowledgeSchema, "flags" | "last_viewed">;

function isUniqueConstraintError(error: unknown) {
    if (typeof error !== "object" || error === null) return false;
    const { code } = error as { code?: unknown };

    return code === "23505" || code === "SQLITE_CONSTRAINT" || code === "SQLITE_CONSTRAINT_UNIQUE";
}

export function advanceNotificationCursorSql(messageIdParameterName = "notificationCursorMessageId") {
    if (DatabaseType === "sqlite" || DatabaseType === "better-sqlite3") {
        return `CAST(max(COALESCE(CAST(NULLIF("notifications_cursor", '') AS INTEGER), 0), COALESCE(CAST(NULLIF("last_message_id", '') AS INTEGER), 0), CAST(:${messageIdParameterName} AS INTEGER)) AS TEXT)`;
    }

    return `GREATEST(COALESCE(NULLIF("notifications_cursor", '')::numeric, 0), COALESCE(NULLIF("last_message_id", '')::numeric, 0), :${messageIdParameterName}::numeric)::text`;
}

function channelReadStateValues(identity: ChannelMessageReadStateIdentity, messageId: string, options: ChannelMessageReadStateOptions = {}) {
    const values: QueryDeepPartialEntity<ReadState> = {
        user_id: identity.user_id,
        channel_id: identity.channel_id,
        read_state_type: ReadStateType.CHANNEL,
        last_message_id: messageId,
        mention_count: 0,
        notifications_cursor: messageId,
    };

    if (options.last_viewed !== undefined) values.last_viewed = options.last_viewed;
    if (options.flags !== undefined) values.flags = options.flags as unknown as QueryDeepPartialEntity<ReadState>["flags"];

    return values;
}

async function updateExistingChannelMessageReadState(identity: ChannelMessageReadStateIdentity, messageId: string, options: ChannelMessageReadStateOptions = {}) {
    const values = channelReadStateValues(identity, messageId, options);
    delete values.user_id;
    delete values.channel_id;
    delete values.read_state_type;
    values.notifications_cursor = () => advanceNotificationCursorSql();

    return ReadState.getRepository()
        .createQueryBuilder()
        .update(ReadState)
        .set(values)
        .where('"user_id" = :userId', { userId: identity.user_id })
        .andWhere('"channel_id" = :channelId', { channelId: identity.channel_id })
        .andWhere('"read_state_type" = :readStateType', { readStateType: ReadStateType.CHANNEL })
        .setParameter("notificationCursorMessageId", messageId)
        .execute();
}

export async function upsertChannelMessageReadState(identity: ChannelMessageReadStateIdentity, messageId: string, options: ChannelMessageReadStateOptions = {}) {
    const updateResult = await updateExistingChannelMessageReadState(identity, messageId, options);
    if ((updateResult.affected ?? 0) > 0) return;

    try {
        await ReadState.getRepository().insert(ReadState.create(channelReadStateValues(identity, messageId, options) as Partial<ReadState>) as ReadState);
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        await updateExistingChannelMessageReadState(identity, messageId, options);
    }
}

export async function upsertAckBulkReadState(user_id: string, update: AckBulkSchema["read_states"][number]) {
    const identity = getReadStateIdentity(user_id, update);

    if (identity.read_state_type === ReadStateType.CHANNEL) {
        await upsertChannelMessageReadState(identity, update.message_id);
        return;
    }

    const readState =
        (await ReadState.findOne({
            where: identity,
        })) ??
        ReadState.create({
            user_id: identity.user_id,
            channel_id: identity.channel_id,
            read_state_type: identity.read_state_type,
        });

    applyAckBulkReadStateUpdate(readState, update);
    await readState.save();
}

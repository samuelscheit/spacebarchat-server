import type { RelationshipType } from "@spacebar/schemas";
import type { ReadyRelationship } from "../../util/interfaces/Event";
import { Snowflake } from "../../util/util/Snowflake";

export interface ReadyRelationshipInput {
    id?: string | null;
    to_id?: string | null;
    to?: { id?: string | null } | null;
    type: RelationshipType;
    nickname?: string | null;
}

function toDiscordIso(date: Date): string {
    return date.toISOString().replace("Z", "+00:00");
}

export function readyRelationshipSinceFromId(id?: string | null): string | null {
    if (!id || !/^\d+$/.test(id)) return null;

    const { timestamp } = Snowflake.deconstruct(id);
    if (!Number.isFinite(timestamp)) return null;

    return toDiscordIso(new Date(timestamp));
}

export function serializeReadyRelationship(relationship: ReadyRelationshipInput): ReadyRelationship {
    const userId = relationship.to_id ?? relationship.to?.id;
    if (!userId) throw new Error("Cannot serialize READY relationship without a target user id");

    return {
        id: userId,
        user_id: userId,
        type: relationship.type,
        nickname: relationship.nickname ?? null,
        since: readyRelationshipSinceFromId(relationship.id),
        is_spam_request: false,
        user_ignored: false,
    };
}

export function serializeReadyRelationships(relationships: ReadyRelationshipInput[]): ReadyRelationship[] {
    return relationships.map((relationship) => serializeReadyRelationship(relationship));
}

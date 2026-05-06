import { ReactionType } from "@spacebar/util/interfaces/Event";
import { normalizeStoredReaction, toPublicReaction, toPublicReactions } from "@spacebar/util/util/Reactions";
import type { PartialEmoji, StoredReaction } from "@spacebar/schemas";

export { normalizeStoredReaction, toPublicReaction, toPublicReactions };

export function parseReactionTypeParam(value: unknown): ReactionType | null {
    if (value === String(ReactionType.normal)) return ReactionType.normal;
    if (value === String(ReactionType.burst)) return ReactionType.burst;
    return null;
}

export function parseOptionalReactionTypeParam(value: unknown): ReactionType | null {
    if (value === undefined) return ReactionType.normal;
    return parseReactionTypeParam(value);
}

export function reactionEmojiEquals(left: PartialEmoji, right: PartialEmoji): boolean {
    return Boolean((left.id === right.id && right.id) || left.name === right.name);
}

export function findReaction(reactions: StoredReaction[], emoji: PartialEmoji): StoredReaction | undefined {
    return reactions.find((reaction) => reactionEmojiEquals(reaction.emoji, emoji));
}

export function getReactionUserIds(reaction: StoredReaction, type: ReactionType): string[] {
    normalizeStoredReaction(reaction);
    return [...getMutableReactionUserIds(reaction, type)];
}

export function hasReactionUsers(reaction: StoredReaction | undefined, type: ReactionType): boolean {
    return Boolean(reaction && getMutableReactionUserIds(reaction, type).length);
}

export function addReactionUser(
    reactions: StoredReaction[],
    emoji: PartialEmoji,
    userId: string,
    type: ReactionType,
): { reaction: StoredReaction; created: boolean; changed: boolean } {
    let reaction = findReaction(reactions, emoji);
    const created = !reaction;

    if (!reaction) {
        reaction = {
            count: 0,
            count_details: { normal: 0, burst: 0 },
            emoji,
            user_ids: [],
            burst_user_ids: [],
            burst_colors: [],
        };
        reactions.push(reaction);
    }

    const users = getMutableReactionUserIds(reaction, type);
    if (users.includes(userId)) return { reaction, created, changed: false };

    users.push(userId);
    updateReactionCountsFromUsers(reaction);

    return { reaction, created, changed: true };
}

export function removeReactionUser(reaction: StoredReaction, userId: string, type: ReactionType): boolean {
    const users = getMutableReactionUserIds(reaction, type);
    const index = users.indexOf(userId);
    if (index === -1) return false;

    users.splice(index, 1);
    updateReactionCountsFromUsers(reaction);

    return true;
}

export function reactionEventTypeData(type: ReactionType): { type: ReactionType; burst: boolean } {
    return {
        type,
        burst: type === ReactionType.burst,
    };
}

export function reactionRemoveEventUserData(userId: string, type: ReactionType): { user_id: string; type: ReactionType; burst: boolean } {
    return {
        user_id: userId,
        ...reactionEventTypeData(type),
    };
}

function getMutableReactionUserIds(reaction: StoredReaction, type: ReactionType): string[] {
    normalizeStoredReaction(reaction);
    return type === ReactionType.burst ? reaction.burst_user_ids! : reaction.user_ids;
}

function updateReactionCountsFromUsers(reaction: StoredReaction) {
    normalizeStoredReaction(reaction);
}

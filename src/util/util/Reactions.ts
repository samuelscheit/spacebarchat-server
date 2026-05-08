import type { Reaction, Snowflake, StoredReaction } from "@spacebar/schemas";

export function normalizeStoredReaction(reaction: StoredReaction): StoredReaction {
    reaction.user_ids = [...new Set(reaction.user_ids ?? [])];
    reaction.burst_user_ids = [...new Set(reaction.burst_user_ids ?? [])];
    reaction.burst_colors ??= [];
    updateReactionCounts(reaction);
    return reaction;
}

export function toPublicReaction(reaction: StoredReaction, userId?: Snowflake): Reaction {
    normalizeStoredReaction(reaction);

    return {
        count: reaction.count,
        count_details: { ...reaction.count_details! },
        ...(userId
            ? {
                  me: reaction.user_ids.includes(userId),
                  me_burst: reaction.burst_user_ids!.includes(userId),
              }
            : undefined),
        emoji: reaction.emoji,
        burst_colors: [...reaction.burst_colors!],
    };
}

export function toPublicReactions(reactions: StoredReaction[] | undefined, userId?: Snowflake): Reaction[] {
    return (reactions ?? []).map((reaction) => toPublicReaction(reaction, userId));
}

function updateReactionCounts(reaction: StoredReaction) {
    const normal = reaction.user_ids.length;
    const burst = reaction.burst_user_ids?.length ?? 0;

    reaction.count_details = { normal, burst };
    reaction.count = normal + burst;
}

import type { IdentifySchema } from "@spacebar/schemas";

export const DefaultIdentifyIntents = 0b11011111111111111111111111111111111n;

export function toIdentifyIntents(intents: IdentifySchema["intents"]): bigint {
    return intents == null ? DefaultIdentifyIntents : BigInt(intents);
}

export function toIdentifyShard(shard: NonNullable<IdentifySchema["shard"]>): [bigint, bigint] {
    return [BigInt(shard[0]), BigInt(shard[1])];
}


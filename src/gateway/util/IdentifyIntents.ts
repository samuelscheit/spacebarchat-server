export const DEFAULT_IDENTIFY_INTENTS = 0b11011111111111111111111111111111111n;

export function resolveIdentifyIntents(intents: bigint | undefined) {
    return intents ?? DEFAULT_IDENTIFY_INTENTS;
}

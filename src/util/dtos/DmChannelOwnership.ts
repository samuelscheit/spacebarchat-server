export function getGroupDMOwnerAfterRecipientRemoval(currentOwnerId: string | undefined, remainingRecipientIds: string[]): string | undefined {
    if (currentOwnerId && remainingRecipientIds.includes(currentOwnerId)) return currentOwnerId;

    const [firstRemainingRecipientId] = [...remainingRecipientIds].sort();
    return firstRemainingRecipientId;
}

export async function saveGroupDMOwnerAfterRecipientRemoval(channel: { owner_id?: string; save: () => Promise<unknown> }, remainingRecipientIds: string[]): Promise<boolean> {
    const nextOwnerId = getGroupDMOwnerAfterRecipientRemoval(channel.owner_id, remainingRecipientIds);
    if (channel.owner_id === nextOwnerId) return false;

    channel.owner_id = nextOwnerId;
    await channel.save();
    return true;
}

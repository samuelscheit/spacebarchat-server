export function getGroupDMOwnerAfterRecipientRemoval(currentOwnerId: string | undefined, remainingRecipientIds: string[]): string | undefined {
    if (currentOwnerId && remainingRecipientIds.includes(currentOwnerId)) return currentOwnerId;

    const [firstRemainingRecipientId] = [...remainingRecipientIds].sort();
    return firstRemainingRecipientId;
}

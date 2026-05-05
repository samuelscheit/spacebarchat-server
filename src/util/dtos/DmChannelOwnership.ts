export function getGroupDMOwnerAfterRecipientRemoval(currentOwnerId: string | undefined, removedUserId: string, remainingRecipientIds: string[]) {
    if (currentOwnerId !== removedUserId) return currentOwnerId;

    return remainingRecipientIds[0];
}

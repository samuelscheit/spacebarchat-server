export function moveChannelInOrder(channel_ordering: string[], channel_id: string, insertPoint: string | number) {
    const ordering = channel_ordering.filter((id) => id !== channel_id);
    const unclampedPosition = typeof insertPoint == "string" ? ordering.indexOf(insertPoint) + 1 : insertPoint;
    const position = Math.max(0, Math.min(unclampedPosition, ordering.length));

    ordering.splice(position, 0, channel_id);
    return { channel_ordering: ordering, position };
}

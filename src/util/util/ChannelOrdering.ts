export type ChannelOrderInsertPoint = string | number;

export type ChannelOrderingPatch = {
    position?: number;
    parent_id?: string | null;
};

export function getInvalidThreadChannelOrderFields(payload: ChannelOrderingPatch, isThread: boolean): (keyof ChannelOrderingPatch)[] {
    if (!isThread) return [];

    const invalidFields: (keyof ChannelOrderingPatch)[] = [];
    if (payload.position !== undefined) invalidFields.push("position");
    if (payload.parent_id !== undefined) invalidFields.push("parent_id");
    return invalidFields;
}

export function getChannelOrderInsertPoint(payload: ChannelOrderingPatch, isThread: boolean): ChannelOrderInsertPoint | undefined {
    if (isThread) return undefined;
    if (payload.position !== undefined) return payload.position;
    if (payload.parent_id !== undefined && payload.parent_id !== null) return payload.parent_id;
    return undefined;
}

export function moveChannelInOrder(channel_ordering: string[], channel_id: string, insertPoint: ChannelOrderInsertPoint) {
    const ordering = channel_ordering.filter((id) => id !== channel_id);
    const unclampedPosition = typeof insertPoint == "string" ? ordering.indexOf(insertPoint) + 1 : insertPoint;
    const position = Math.max(0, Math.min(unclampedPosition, ordering.length));

    ordering.splice(position, 0, channel_id);
    return { channel_ordering: ordering, position };
}

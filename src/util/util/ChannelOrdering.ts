export type ChannelOrderInsertPoint = string | number;

export type ChannelOrderingPatch = {
    position?: number;
    parent_id?: string | null;
};

export function normalizeChannelOrdering(channelOrdering: string[] | null | undefined) {
    return channelOrdering ?? [];
}

export function insertChannelInOrdering(channelOrdering: string[] | null | undefined, channelId: string, insertPoint: ChannelOrderInsertPoint) {
    const ordering = normalizeChannelOrdering(channelOrdering).filter((id) => id !== channelId);
    const position = typeof insertPoint === "string" ? ordering.indexOf(insertPoint) + 1 : insertPoint;
    const boundedPosition = Math.max(0, Math.min(position, ordering.length));

    ordering.splice(boundedPosition, 0, channelId);

    return { ordering, position: boundedPosition };
}

export function removeChannelOrderingFromGuildSave<T extends { channel_ordering?: string[] | null | undefined }>(guild: T) {
    delete guild.channel_ordering;
    return guild;
}

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

export function moveChannelInOrder(channel_ordering: string[] | null | undefined, channel_id: string, insertPoint: ChannelOrderInsertPoint) {
    const { ordering, position } = insertChannelInOrdering(channel_ordering, channel_id, insertPoint);
    return { channel_ordering: ordering, position };
}

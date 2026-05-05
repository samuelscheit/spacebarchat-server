export type TemplateChannelOrderLike = {
    id?: string | null;
    parent_id?: string | null;
    position?: number | null;
};

export function sortTemplateChannelsForCreation<T extends TemplateChannelOrderLike>(channels: T[]): T[] {
    return channels.toSorted((a, b) => {
        const parentSort = Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id));
        if (parentSort !== 0) return parentSort;

        return (a.position ?? 0) - (b.position ?? 0);
    });
}

export function getTemplateChannelInsertPoint<T extends TemplateChannelOrderLike>(channel: T, parentId: string | undefined, lastChildByParent: Map<string, string>) {
    if (!parentId) return channel.position ?? 0;

    return lastChildByParent.get(parentId) ?? parentId;
}

export function sortChannelsByChannelOrdering<T extends { id?: string | null }>(channels: T[], channelOrdering: string[] | undefined): T[] {
    const channelPositions = new Map(channelOrdering?.map((id, index) => [id, index]) ?? []);

    return channels.toSorted((a, b) => {
        const aPosition = a.id ? channelPositions.get(a.id) : undefined;
        const bPosition = b.id ? channelPositions.get(b.id) : undefined;

        return (aPosition ?? Number.MAX_SAFE_INTEGER) - (bPosition ?? Number.MAX_SAFE_INTEGER);
    });
}

export type TemplateChannelOrderLike = {
    id?: string | null;
    parent_id?: string | null;
    position?: number | null;
};

export function sortTemplateChannelsForCreation<T extends TemplateChannelOrderLike>(channels: T[]): T[] {
    const channelsById = new Map(channels.filter((channel) => channel.id).map((channel) => [channel.id as string, channel]));
    const sorted: T[] = [];
    const visited = new Set<T>();
    const visiting = new Set<T>();

    const visit = (channel: T) => {
        if (visited.has(channel)) return;
        if (visiting.has(channel)) return;

        visiting.add(channel);

        const parent = channel.parent_id ? channelsById.get(channel.parent_id) : undefined;
        if (parent) visit(parent);

        visiting.delete(channel);
        visited.add(channel);
        sorted.push(channel);
    };

    channels.forEach(visit);

    return sorted;
}

export function sortChannelsByChannelOrdering<T extends { id?: string | null }>(channels: T[], channelOrdering: string[] | undefined): T[] {
    const channelPositions = new Map(channelOrdering?.map((id, index) => [id, index]) ?? []);

    return channels.toSorted((a, b) => {
        const aPosition = a.id ? channelPositions.get(a.id) : undefined;
        const bPosition = b.id ? channelPositions.get(b.id) : undefined;

        return (aPosition ?? Number.MAX_SAFE_INTEGER) - (bPosition ?? Number.MAX_SAFE_INTEGER);
    });
}

export function mapTemplateChannelOrdering<T extends TemplateChannelOrderLike>(channels: T[], resolveCreatedId: (channel: T) => string | undefined): string[] {
    return channels.map(resolveCreatedId).filter((id): id is string => Boolean(id));
}

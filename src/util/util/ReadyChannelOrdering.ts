type ReadyChannel = {
    id: string;
    parent_id?: string | null;
    position?: number;
    type?: number;
};

const GUILD_CATEGORY = 4;

export const applyReadyChannelOrdering = <T extends ReadyChannel>(channels: T[], channelOrdering: string[] | null | undefined): (T & { position: number })[] => {
    const positionById = new Map((channelOrdering ?? []).map((id, index) => [id, index]));
    const fallbackStart = positionById.size;
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const orderRank = (channel: T, index: number) => positionById.get(channel.id) ?? fallbackStart + index;
    const topLevelChannels: { channel: T; index: number }[] = [];
    const childrenByParentId = new Map<string, { channel: T; index: number }[]>();

    channels.forEach((channel, index) => {
        const parent = channel.parent_id ? channelById.get(channel.parent_id) : undefined;
        if (parent && parent.type === GUILD_CATEGORY) {
            const children = childrenByParentId.get(parent.id) ?? [];
            children.push({ channel, index });
            childrenByParentId.set(parent.id, children);
            return;
        }

        topLevelChannels.push({ channel, index });
    });

    const sortedChannels: (T & { position: number })[] = [];
    const byReadyRank = (a: { channel: T; index: number }, b: { channel: T; index: number }) => orderRank(a.channel, a.index) - orderRank(b.channel, b.index);

    topLevelChannels.sort(byReadyRank).forEach(({ channel }, position) => {
        channel.position = position;
        sortedChannels.push(channel as T & { position: number });

        const children = childrenByParentId.get(channel.id);
        if (!children) return;

        children.sort(byReadyRank).forEach(({ channel }, position) => {
            channel.position = position;
            sortedChannels.push(channel as T & { position: number });
        });
    });

    return sortedChannels;
};

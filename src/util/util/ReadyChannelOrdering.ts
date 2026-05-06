import { ChannelType } from "../../schemas/api/channels/Channel";

type ReadyChannel = {
    id: string;
    parent_id?: string | null;
    position?: number;
    type?: ChannelType | number;
};

const GUILD_CATEGORY = ChannelType.GUILD_CATEGORY;

type IndexedChannel<T extends ReadyChannel> = {
    channel: T;
    index: number;
    rank: number;
};

const buildPositionById = (channelOrdering: readonly string[] | null | undefined) =>
    (channelOrdering ?? []).reduce((positionById, channelId, index) => {
        if (!positionById.has(channelId)) positionById.set(channelId, index);
        return positionById;
    }, new Map<string, number>());

export const applyReadyChannelOrdering = <T extends ReadyChannel>(channels: T[], channelOrdering: readonly string[] | null | undefined): (T & { position: number })[] => {
    const orderedChannelIds = channelOrdering ?? [];
    const positionById = buildPositionById(orderedChannelIds);
    const fallbackStart = orderedChannelIds.length;
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const indexedChannel = (channel: T, index: number): IndexedChannel<T> => ({
        channel,
        index,
        rank: positionById.get(channel.id) ?? fallbackStart + index,
    });
    const topLevelChannels: IndexedChannel<T>[] = [];
    const childrenByParentId = new Map<string, IndexedChannel<T>[]>();

    channels.forEach((channel, index) => {
        const parent = channel.parent_id ? channelById.get(channel.parent_id) : undefined;
        if (parent && parent.type === GUILD_CATEGORY) {
            const children = childrenByParentId.get(parent.id) ?? [];
            children.push(indexedChannel(channel, index));
            childrenByParentId.set(parent.id, children);
            return;
        }

        topLevelChannels.push(indexedChannel(channel, index));
    });

    const sortedChannels: (T & { position: number })[] = [];
    const byReadyRank = (a: IndexedChannel<T>, b: IndexedChannel<T>) => a.rank - b.rank || a.index - b.index;

    topLevelChannels.sort(byReadyRank).forEach(({ channel }, position) => {
        channel.position = position;
        sortedChannels.push(channel as T & { position: number });

        childrenByParentId
            .get(channel.id)
            ?.sort(byReadyRank)
            .forEach(({ channel }, position) => {
                channel.position = position;
                sortedChannels.push(channel as T & { position: number });
            });
    });

    return sortedChannels;
};

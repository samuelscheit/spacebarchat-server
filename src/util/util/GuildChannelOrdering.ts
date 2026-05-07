import type { ColumnOptions } from "typeorm";
import { insertChannelInOrdering } from "./ChannelOrdering";

export interface GuildChannelOrderingContainer {
    channel_ordering?: string[] | null;
}

export type TemplateChannelOrderLike = {
    id?: string | null;
    parent_id?: string | null;
    position?: number | null;
};

export function getGuildChannelOrderingColumnOptions(databaseType = process.env.DATABASE?.split(":")[0]?.replace("+srv", "")): ColumnOptions {
    if (!databaseType || databaseType === "postgres") {
        return {
            select: false,
            type: "int8",
            array: true,
            default: [],
        };
    }

    return {
        select: false,
        type: "simple-array",
        default: "",
    };
}

export function getGuildChannelOrdering(guild: GuildChannelOrderingContainer): string[] {
    if (!Array.isArray(guild.channel_ordering)) guild.channel_ordering = [];
    return guild.channel_ordering;
}

export function getGuildChannelPosition(guild: GuildChannelOrderingContainer, channelId: string): number {
    return getGuildChannelOrdering(guild).indexOf(channelId);
}

export function insertInGuildChannelOrdering(guild: GuildChannelOrderingContainer, channelId: string, insertPoint: string | number): number {
    const { ordering, position } = insertChannelInOrdering(guild.channel_ordering, channelId, insertPoint);
    guild.channel_ordering = ordering;
    return position;
}

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

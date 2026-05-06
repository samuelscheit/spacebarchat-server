import type { ColumnOptions } from "typeorm";

export interface GuildChannelOrderingContainer {
    channel_ordering?: string[] | null;
}

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
    const channelOrdering = getGuildChannelOrdering(guild);
    const existingIndex = channelOrdering.indexOf(channelId);
    if (existingIndex > -1) channelOrdering.splice(existingIndex, 1);

    let position = typeof insertPoint === "string" ? channelOrdering.indexOf(insertPoint) + 1 : insertPoint;
    position = Math.max(0, Math.min(position, channelOrdering.length));

    channelOrdering.splice(position, 0, channelId);
    return position;
}

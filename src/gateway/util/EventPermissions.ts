export interface EventPermissionSource {
    id?: string;
    guild_id?: string;
    channel_id?: string;
}

export function getEventPermissionLookupId(event: string, data: EventPermissionSource): string | undefined {
    if (event === "WEBHOOKS_UPDATE") return data.guild_id ?? data.id;
    if (event === "MESSAGE_ACK") return data.channel_id ?? data.id;

    return data.id;
}

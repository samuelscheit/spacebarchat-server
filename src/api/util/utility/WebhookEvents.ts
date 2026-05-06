export interface WebhooksUpdateEventSource {
    guild_id?: string | null;
    channel_id: string;
}

export function buildWebhooksUpdateEventData(source: WebhooksUpdateEventSource) {
    return {
        channel_id: source.channel_id,
        guild_id: source.guild_id as string,
    };
}

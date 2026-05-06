import type { WebhooksUpdateEvent } from "@spacebar/util/interfaces/Event";

export interface WebhooksUpdateEventSource {
    guild_id?: string | null;
    channel_id: string;
    channel?: {
        guild_id?: string | null;
    } | null;
}

export type WebhooksUpdateDispatchEvent = Omit<WebhooksUpdateEvent, "created_at">;

export function buildWebhooksUpdateEventData(source: WebhooksUpdateEventSource): WebhooksUpdateEvent["data"] | undefined {
    const guild_id = source.guild_id ?? source.channel?.guild_id;
    if (!guild_id) return undefined;

    return {
        channel_id: source.channel_id,
        guild_id,
    };
}

export function buildWebhooksUpdateEvent(source: WebhooksUpdateEventSource): WebhooksUpdateDispatchEvent | undefined {
    const data = buildWebhooksUpdateEventData(source);
    if (!data) return undefined;

    return {
        event: "WEBHOOKS_UPDATE",
        channel_id: data.channel_id,
        data,
    };
}

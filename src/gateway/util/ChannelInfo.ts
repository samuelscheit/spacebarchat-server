type ChannelInfoField = "status" | "voice_start_time" | string;

type ChannelInfoSource = {
    id: string;
    status?: string | null;
};

export type ChannelInfoPayload = {
    id: string;
    status?: string | null;
    voice_start_time?: string | null;
};

export function createChannelInfoPayload(channel: ChannelInfoSource, fields: ChannelInfoField[]): ChannelInfoPayload {
    return {
        id: channel.id,
        status: fields.includes("status") ? (channel.status ?? null) : undefined,
        voice_start_time: fields.includes("voice_start_time") ? null : undefined,
    };
}

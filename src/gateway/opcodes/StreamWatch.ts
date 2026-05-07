import { genVoiceToken, parseStreamKey, Payload, WebSocket } from "@spacebar/gateway";
import { Config, emitEvent, Stream, StreamCreateEvent, StreamServerUpdateEvent, StreamSession } from "@spacebar/util";
import { check } from "./instanceOf";
import { Not } from "typeorm";
import { StreamWatchSchema } from "@spacebar/schemas";
import { assertCallStreamKeyMatchesChannel, assertGatewayChannelAccess, assertGatewayVoiceChannel, assertGuildStreamKeyMatchesChannel } from "../util/Authorization";

export async function onStreamWatch(this: WebSocket, data: Payload) {
    const startTime = Date.now();
    check.call(this, StreamWatchSchema, data.d);
    const body = data.d as StreamWatchSchema;

    let parsedKey: {
        type: "guild" | "call";
        channelId: string;
        guildId?: string;
        userId: string;
    };

    try {
        parsedKey = parseStreamKey(body.stream_key);
    } catch (e) {
        return this.close(4000, "Invalid stream key");
    }

    const { type, channelId, guildId, userId } = parsedKey;

    let channel;
    try {
        ({ channel } = await assertGatewayChannelAccess({
            userId: this.user_id,
            guildId,
            channelId,
            permission: "CONNECT",
        }));
        assertGatewayVoiceChannel(channel);

        if (type === "guild") assertGuildStreamKeyMatchesChannel(guildId, channel);
        else assertCallStreamKeyMatchesChannel(channel);
    } catch {
        return this.close(4000, "Invalid stream key");
    }

    const stream = await Stream.findOne({
        where: { channel_id: channelId, owner_id: userId },
        relations: { channel: true },
    });

    if (!stream) return this.close(4000, "Invalid stream key");

    if (stream.channel_id !== channel.id) return this.close(4000, "Invalid stream key");
    if (type === "guild" && stream.channel.guild_id != guildId) return this.close(4000, "Invalid stream key");

    const regions = Config.get().regions;
    const guildRegion = regions.available.find((r) => r.endpoint === stream.endpoint);

    if (!guildRegion) return this.close(4000, "Unknown region");

    const streamSession = StreamSession.create({
        stream_id: stream.id,
        user_id: this.user_id,
        session_id: this.session_id,
        token: genVoiceToken(),
    });

    await streamSession.save();

    // get the viewers: stream session tokens for this stream that have been used but not including stream owner
    const viewers = await StreamSession.find({
        where: {
            stream_id: stream.id,
            used: true,
            user_id: Not(stream.owner_id),
        },
    });

    await emitEvent({
        event: "STREAM_CREATE",
        data: {
            stream_key: body.stream_key,
            rtc_server_id: stream.id, // for voice connections in guilds it is guild_id, for dm voice calls it seems to be DM channel id, for GoLive streams a generated number
            viewer_ids: viewers.map((v) => v.user_id),
            region: guildRegion.name,
            paused: false,
        },
        channel_id: channelId,
        user_id: this.user_id,
    } satisfies StreamCreateEvent);

    await emitEvent({
        event: "STREAM_SERVER_UPDATE",
        data: {
            token: streamSession.token,
            stream_key: body.stream_key,
            guild_id: null, // not sure why its always null
            endpoint: stream.endpoint,
        },
        user_id: this.user_id,
    } satisfies StreamServerUpdateEvent);

    console.log(`[Gateway/${this.user_id}] STREAM_WATCH for user ${this.user_id} in channel ${channelId} with stream key ${body.stream_key} in ${Date.now() - startTime}ms`);
}

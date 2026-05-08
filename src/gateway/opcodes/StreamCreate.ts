import { genVoiceToken, Payload, WebSocket, generateStreamKey } from "@spacebar/gateway";
import {
    Config,
    emitEvent,
    Member,
    Snowflake,
    Stream,
    VoiceStateMemberRelations,
    memberToVoiceStateMember,
    StreamCreateEvent,
    StreamServerUpdateEvent,
    StreamSession,
    VoiceState,
    VoiceStateUpdateEvent,
} from "@spacebar/util";
import { check } from "./instanceOf";
import { StreamCreateSchema } from "@spacebar/schemas";
import { selectStreamRegion } from "../util/StreamRegion";
import { assertCallStreamKeyMatchesChannel, assertGatewayChannelAccess, assertGatewayVoiceChannel, assertGuildStreamKeyMatchesChannel } from "../util/Authorization";

export async function onStreamCreate(this: WebSocket, data: Payload) {
    const startTime = Date.now();
    check.call(this, StreamCreateSchema, data.d);
    const body = data.d as StreamCreateSchema;

    if (body.channel_id.trim().length === 0) return;

    // first check if we are in a voice channel already. cannot create a stream if there's no existing voice connection
    const voiceState = await VoiceState.findOne({
        where: { user_id: this.user_id },
    });

    if (!voiceState || !voiceState.channel_id || voiceState.session_id !== this.session_id) return;

    const { channel } = await assertGatewayChannelAccess({
        userId: this.user_id,
        guildId: body.guild_id,
        channelId: body.channel_id,
        permission: ["CONNECT", "STREAM"],
    });
    assertGatewayVoiceChannel(channel);

    if (body.type === "guild") {
        assertGuildStreamKeyMatchesChannel(body.guild_id, channel);
        body.guild_id = channel.guild_id;
    } else {
        assertCallStreamKeyMatchesChannel(channel);
        body.guild_id = undefined;
    }
    body.channel_id = channel.id;

    if (voiceState.channel_id !== channel.id || (voiceState.guild_id ?? undefined) !== (channel.guild_id ?? undefined)) return this.close(4000, "invalid channel");

    const member = body.guild_id
        ? await Member.findOne({
              where: { id: voiceState.user_id, guild_id: voiceState.guild_id },
              relations: VoiceStateMemberRelations,
          })
        : undefined;

    const regions = Config.get().regions;
    const guildRegion = selectStreamRegion(regions, body.preferred_region);

    // first make sure theres no other streams for this user that somehow didnt get cleared
    await Stream.delete({
        owner_id: this.user_id,
    });

    // create a new entry in db containing the token for authenticating user in stream gateway IDENTIFY
    const stream = Stream.create({
        id: Snowflake.generate(),
        owner_id: this.user_id,
        channel_id: body.channel_id,
        endpoint: guildRegion.endpoint,
    });

    await stream.save();

    const token = genVoiceToken();

    const streamSession = StreamSession.create({
        stream_id: stream.id,
        user_id: this.user_id,
        session_id: this.session_id,
        token,
    });

    await streamSession.save();

    const streamKey = generateStreamKey(body.type, body.guild_id, body.channel_id, this.user_id);

    await emitEvent({
        event: "STREAM_CREATE",
        data: {
            stream_key: streamKey,
            rtc_server_id: stream.id, // for voice connections in guilds it is guild_id, for dm voice calls it seems to be DM channel id, for GoLive streams a generated number
            viewer_ids: [],
            region: guildRegion.name,
            paused: false,
        },
        user_id: this.user_id,
    } satisfies StreamCreateEvent);

    await emitEvent({
        event: "STREAM_SERVER_UPDATE",
        data: {
            token: streamSession.token,
            stream_key: streamKey,
            guild_id: null, // not sure why its always null
            endpoint: stream.endpoint,
        },
        user_id: this.user_id,
    } satisfies StreamServerUpdateEvent);

    voiceState.self_stream = true;
    await voiceState.save();

    await emitEvent({
        event: "VOICE_STATE_UPDATE",
        data: {
            ...voiceState.toPublicVoiceState(),
            member: member ? memberToVoiceStateMember(member) : undefined,
        },
        guild_id: voiceState.guild_id,
        channel_id: voiceState.channel_id,
    } satisfies VoiceStateUpdateEvent);

    console.log(`[Gateway/${this.user_id}] STREAM_CREATE for user ${this.user_id} in channel ${body.channel_id} with stream key ${streamKey} in ${Date.now() - startTime}ms`);
}

//stream key:
// guild:${guild_id}:${channel_id}:${user_id}
// call:${channel_id}:${user_id}

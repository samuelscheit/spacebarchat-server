import { Channel, DiscordApiErrors, emitEvent, getPermission, Member, Permissions, VoiceState, VoiceStateUpdateEvent } from "@spacebar/util";
import { ChannelType, PublicMember, PublicVoiceState, VoiceStateUpdateSchema } from "@spacebar/schemas";

type PermissionGuard = Pick<Permissions, "hasThrow">;
interface VoiceStateMember {
    toPublicMember(): PublicMember;
}

interface VoiceStateRecord {
    guild_id: string;
    channel_id: string;
    user_id: string;
    member: VoiceStateMember;
    assign(body: VoiceStateUpdateSchema): unknown;
    save(): Promise<unknown>;
    toPublicVoiceState(): PublicVoiceState;
}

type StageVoiceChannel = Pick<Channel, "id" | "guild_id" | "type">;

export interface ModifyVoiceStateDependencies {
    getPermission(user_id: string, guild_id: string, channel_id: string | undefined): Promise<PermissionGuard>;
    findVoiceState(guild_id: string, channel_id: string | undefined, user_id: string): Promise<VoiceStateRecord | null>;
    findChannel(guild_id: string, channel_id: string | undefined): Promise<StageVoiceChannel>;
    findMember(guild_id: string, user_id: string): Promise<VoiceStateMember>;
    saveVoiceState(voiceState: VoiceStateRecord): Promise<unknown>;
    emitVoiceStateUpdate(guild_id: string, voiceState: VoiceStateRecord): Promise<void>;
    now(): Date;
}

export const defaultModifyVoiceStateDependencies: ModifyVoiceStateDependencies = {
    getPermission,
    findVoiceState: (guild_id, channel_id, user_id) =>
        VoiceState.findOne({
            where: {
                guild_id,
                channel_id,
                user_id,
            },
        }) as Promise<VoiceStateRecord | null>,
    findChannel: (guild_id, channel_id) =>
        Channel.findOneOrFail({
            where: { guild_id, id: channel_id },
        }) as Promise<StageVoiceChannel>,
    findMember: (guild_id, user_id) =>
        Member.findOneOrFail({
            where: {
                id: user_id,
                guild_id,
            },
        }) as Promise<VoiceStateMember>,
    saveVoiceState: (voiceState) => voiceState.save(),
    emitVoiceStateUpdate: (guild_id, voiceState) =>
        emitEvent({
            event: "VOICE_STATE_UPDATE",
            data: {
                ...voiceState.toPublicVoiceState(),
                member: voiceState.member.toPublicMember(),
            },
            guild_id,
        } satisfies VoiceStateUpdateEvent),
    now: () => new Date(),
};

export async function modifyVoiceState(
    actingUserId: string,
    guild_id: string,
    user_id: string,
    body: VoiceStateUpdateSchema,
    deps = defaultModifyVoiceStateDependencies,
): Promise<void> {
    const perms = await deps.getPermission(actingUserId, guild_id, body.channel_id);

    /*
	From https://discord.com/developers/docs/resources/guild#modify-current-user-voice-state
	You must have the MUTE_MEMBERS permission to unsuppress others. You can always suppress yourself.
	You must have the REQUEST_TO_SPEAK permission to request to speak. You can always clear your own request to speak.
	 */
    if (body.suppress && user_id !== actingUserId) {
        perms.hasThrow("MUTE_MEMBERS");
    }
    if (!body.suppress) body.request_to_speak_timestamp = deps.now();
    if (body.request_to_speak_timestamp) perms.hasThrow("REQUEST_TO_SPEAK");

    const voiceState = await deps.findVoiceState(guild_id, body.channel_id, user_id);
    if (!voiceState) throw DiscordApiErrors.UNKNOWN_VOICE_STATE;

    voiceState.assign(body);
    const channel = await deps.findChannel(guild_id, body.channel_id);
    if (channel.type !== ChannelType.GUILD_STAGE_VOICE) {
        throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
    }

    voiceState.member = await deps.findMember(voiceState.guild_id, voiceState.user_id);

    await Promise.all([deps.saveVoiceState(voiceState), deps.emitVoiceStateUpdate(guild_id, voiceState)]);
}

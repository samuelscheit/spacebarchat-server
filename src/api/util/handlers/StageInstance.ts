import { Channel, DiscordApiErrors, emitEvent, FieldErrors, getPermission, Permissions, StageInstance } from "@spacebar/util";
import { ChannelType, StageInstanceCreateSchema, StageInstanceModifySchema, StageInstancePrivacyLevel, StageInstanceResponse } from "@spacebar/schemas";

export const STAGE_INSTANCE_TOPIC_MIN_LENGTH = 1;
export const STAGE_INSTANCE_TOPIC_MAX_LENGTH = 120;
export const STAGE_INSTANCE_MODERATOR_PERMISSIONS = ["MANAGE_CHANNELS", "MUTE_MEMBERS", "MOVE_MEMBERS"] as const;

type StageInstanceModeratorPermission = (typeof STAGE_INSTANCE_MODERATOR_PERMISSIONS)[number];

type PermissionGuard = Pick<Permissions, "hasThrow">;

type StageChannel = Pick<Channel, "id" | "guild_id" | "type">;

type StageInstanceRecord = Pick<StageInstance, "id" | "guild_id" | "channel_id" | "topic" | "privacy_level" | "discoverable_disabled" | "guild_scheduled_event_id">;

export interface StageInstanceDependencies {
    findChannel(channel_id: string): Promise<StageChannel | null>;
    findStageInstance(channel_id: string): Promise<StageInstanceRecord | null>;
    createStageInstance(data: Omit<StageInstanceResponse, "id">): StageInstanceRecord;
    saveStageInstance(stageInstance: StageInstanceRecord): Promise<StageInstanceRecord>;
    deleteStageInstance(stageInstance: StageInstanceRecord): Promise<void>;
    getPermission(user_id: string, guild_id: string, channel_id: string): Promise<PermissionGuard>;
    emitStageInstanceEvent(event: "STAGE_INSTANCE_CREATE" | "STAGE_INSTANCE_UPDATE" | "STAGE_INSTANCE_DELETE", channel_id: string, data: StageInstanceResponse): Promise<void>;
}

export const defaultStageInstanceDependencies: StageInstanceDependencies = {
    findChannel: (channel_id) => Channel.findOne({ where: { id: channel_id } }),
    findStageInstance: (channel_id) => StageInstance.findOne({ where: { channel_id } }),
    createStageInstance: (data) => StageInstance.create(data as Partial<StageInstance>) as StageInstance,
    saveStageInstance: (stageInstance) => (stageInstance as StageInstance).save(),
    deleteStageInstance: async (stageInstance) => {
        await StageInstance.delete({ id: stageInstance.id });
    },
    getPermission,
    emitStageInstanceEvent: (event, channel_id, data) => emitEvent({ event, channel_id, data }),
};

export function stageInstanceToResponse(stageInstance: StageInstanceRecord): StageInstanceResponse {
    return {
        id: stageInstance.id,
        guild_id: stageInstance.guild_id,
        channel_id: stageInstance.channel_id,
        topic: stageInstance.topic,
        privacy_level: stageInstance.privacy_level,
        discoverable_disabled: stageInstance.discoverable_disabled,
        guild_scheduled_event_id: stageInstance.guild_scheduled_event_id ?? null,
    };
}

export function assertStageInstanceTopic(topic: string) {
    if (topic.length < STAGE_INSTANCE_TOPIC_MIN_LENGTH || topic.length > STAGE_INSTANCE_TOPIC_MAX_LENGTH) {
        throw FieldErrors({
            topic: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: `Stage instance topic must be between ${STAGE_INSTANCE_TOPIC_MIN_LENGTH} and ${STAGE_INSTANCE_TOPIC_MAX_LENGTH} characters`,
            },
        });
    }
}

export function assertStageChannel(channel: Pick<StageChannel, "type">) {
    if (channel.type !== ChannelType.GUILD_STAGE_VOICE) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
}

export function assertStageInstanceModerator(permission: PermissionGuard) {
    STAGE_INSTANCE_MODERATOR_PERMISSIONS.forEach((requiredPermission: StageInstanceModeratorPermission) => permission.hasThrow(requiredPermission));
}

async function getExistingStageChannel(channel_id: string, deps: StageInstanceDependencies): Promise<StageChannel> {
    const channel = await deps.findChannel(channel_id);
    if (!channel) throw DiscordApiErrors.UNKNOWN_CHANNEL;
    if (!channel.guild_id) throw DiscordApiErrors.CANNOT_EXECUTE_ON_DM;
    assertStageChannel(channel);
    return channel;
}

async function getExistingStageInstance(channel_id: string, deps: StageInstanceDependencies): Promise<StageInstanceRecord> {
    const stageInstance = await deps.findStageInstance(channel_id);
    if (!stageInstance) throw DiscordApiErrors.UNKNOWN_STAGE_INSTANCE;
    return stageInstance;
}

async function requireStageInstanceModerator(user_id: string, channel: StageChannel, deps: StageInstanceDependencies) {
    const permission = await deps.getPermission(user_id, channel.guild_id!, channel.id);
    assertStageInstanceModerator(permission);
}

export async function createStageInstance(user_id: string, body: StageInstanceCreateSchema, deps = defaultStageInstanceDependencies): Promise<StageInstanceResponse> {
    const channel = await getExistingStageChannel(body.channel_id, deps);
    await requireStageInstanceModerator(user_id, channel, deps);
    assertStageInstanceTopic(body.topic);

    const existing = await deps.findStageInstance(channel.id);
    if (existing) throw DiscordApiErrors.STAGE_ALREADY_OPEN;

    const stageInstance = deps.createStageInstance({
        guild_id: channel.guild_id!,
        channel_id: channel.id,
        topic: body.topic,
        privacy_level: body.privacy_level ?? StageInstancePrivacyLevel.GuildOnly,
        discoverable_disabled: false,
        guild_scheduled_event_id: body.guild_scheduled_event_id ?? null,
    });

    const saved = await deps.saveStageInstance(stageInstance);
    const response = stageInstanceToResponse(saved);
    await deps.emitStageInstanceEvent("STAGE_INSTANCE_CREATE", channel.id, response);
    return response;
}

export async function getStageInstance(channel_id: string, deps = defaultStageInstanceDependencies): Promise<StageInstanceResponse> {
    await getExistingStageChannel(channel_id, deps);
    return stageInstanceToResponse(await getExistingStageInstance(channel_id, deps));
}

export async function modifyStageInstance(
    user_id: string,
    channel_id: string,
    body: StageInstanceModifySchema,
    deps = defaultStageInstanceDependencies,
): Promise<StageInstanceResponse> {
    const channel = await getExistingStageChannel(channel_id, deps);
    await requireStageInstanceModerator(user_id, channel, deps);

    const stageInstance = await getExistingStageInstance(channel_id, deps);
    if (body.privacy_level !== undefined) stageInstance.privacy_level = body.privacy_level;

    const saved = await deps.saveStageInstance(stageInstance);
    const response = stageInstanceToResponse(saved);
    await deps.emitStageInstanceEvent("STAGE_INSTANCE_UPDATE", channel.id, response);
    return response;
}

export async function deleteStageInstance(user_id: string, channel_id: string, deps = defaultStageInstanceDependencies): Promise<void> {
    const channel = await getExistingStageChannel(channel_id, deps);
    await requireStageInstanceModerator(user_id, channel, deps);

    const stageInstance = await getExistingStageInstance(channel_id, deps);
    const response = stageInstanceToResponse(stageInstance);
    await deps.deleteStageInstance(stageInstance);
    await deps.emitStageInstanceEvent("STAGE_INSTANCE_DELETE", channel.id, response);
}

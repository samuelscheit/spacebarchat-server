import type { InstanceConfigResponse } from "../../../schemas/responses/InstanceConfigResponse";

interface InstanceConfigSource {
    limits: {
        user: {
            maxGuilds: number;
            maxBio: number;
        };
        guild: {
            maxEmojis: number;
            maxRoles: number;
        };
        message: {
            maxCharacters: number;
            maxAttachmentSize: number;
            maxEmbedDownloadSize: number;
        };
        channel: {
            maxWebhooks: number;
        };
    };
    register: {
        dateOfBirth: {
            required: boolean;
        };
        password: {
            required: boolean;
        };
        disabled: boolean;
        requireInvite: boolean;
        allowNewRegistration: boolean;
        allowMultipleAccounts: boolean;
        email: {
            required: boolean;
        };
    };
    guild: {
        autoJoin: {
            canLeave: boolean;
            guilds: string[];
        };
    };
    email: {
        provider: string | null;
    };
    general: {
        frontPage: string | null;
    };
}

export function getPublicInstanceConfigResponse(general: InstanceConfigSource): InstanceConfigResponse {
    return {
        limits_user_maxGuilds: general.limits.user.maxGuilds,
        limits_user_maxBio: general.limits.user.maxBio,
        limits_guild_maxEmojis: general.limits.guild.maxEmojis,
        limits_guild_maxRoles: general.limits.guild.maxRoles,
        limits_message_maxCharacters: general.limits.message.maxCharacters,
        limits_message_maxAttachmentSize: general.limits.message.maxAttachmentSize,
        limits_message_maxEmbedDownloadSize: general.limits.message.maxEmbedDownloadSize,
        limits_channel_maxWebhooks: general.limits.channel.maxWebhooks,
        register_dateOfBirth_requiredc: general.register.dateOfBirth.required,
        register_password_required: general.register.password.required,
        register_disabled: general.register.disabled,
        register_requireInvite: general.register.requireInvite,
        register_allowNewRegistration: general.register.allowNewRegistration,
        register_allowMultipleAccounts: general.register.allowMultipleAccounts,
        guild_autoJoin_canLeave: general.guild.autoJoin.canLeave,
        guild_autoJoin_guilds_x: general.guild.autoJoin.guilds,
        register_email_required: general.register.email.required,
        can_recover_account: general.email.provider != null && general.general.frontPage != null,
    };
}

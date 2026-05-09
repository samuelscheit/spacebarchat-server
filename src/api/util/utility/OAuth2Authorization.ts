import { DiscordApiErrors, Guild, type Permissions, User } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { assertMfaCode, consumeMfaBackupCode } from "./Totp";

interface OAuth2AuthorizationUser {
    id: string;
    bot: boolean;
    mfa_enabled: boolean;
    totp_secret?: string | null;
}

interface UserRepository {
    findOneOrFail(options: unknown): Promise<OAuth2AuthorizationUser>;
}

interface GuildRepository {
    findOneOrFail(options: unknown): Promise<{ id: string; mfa_level?: number | null }>;
}

type AssertOAuth2MfaCode = typeof assertMfaCode;

export interface RequireOAuth2BotAuthorizationOptions {
    getPermission(userId: string, guildId: string, channelId: undefined): Promise<Permissions>;
    guildId: string;
    guildRepository?: GuildRepository;
    mfaCode: unknown;
    assertMfaCodeFn?: AssertOAuth2MfaCode;
    userId: string;
    userRepository?: UserRepository;
}

export async function requireOAuth2BotAuthorization({
    assertMfaCodeFn = assertMfaCode,
    getPermission,
    guildId,
    guildRepository = Guild as unknown as GuildRepository,
    mfaCode,
    userId,
    userRepository = User as unknown as UserRepository,
}: RequireOAuth2BotAuthorizationOptions): Promise<void> {
    const user = await userRepository.findOneOrFail({
        where: { id: userId },
        select: { id: true, bot: true, mfa_enabled: true, totp_secret: true },
    });

    if (user.bot) throw DiscordApiErrors.UNAUTHORIZED;

    const perms = await getPermission(userId, guildId, undefined);

    perms.hasThrow("MANAGE_GUILD");

    const guild = await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true, mfa_level: true },
    });

    if (!guild.mfa_level) return;

    if (!user.mfa_enabled) throw DiscordApiErrors.TWO_FACTOR_REQUIRED;

    await assertMfaCodeFn({
        code: mfaCode,
        mfa_enabled: user.mfa_enabled,
        totp_secret: user.totp_secret,
        invalidCodeError: () => new HTTPError("Invalid two-factor code", 60008),
        consumeBackupCode: (code) => consumeMfaBackupCode({ code, userId }),
    });
}

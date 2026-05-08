import { PublicUserProjection, type PublicUser } from "../../../schemas/api/users/User";
import type { GuildBanResponse } from "../../../schemas/responses/GuildBansResponse";

export const BanResponseUserSelect = Object.fromEntries(PublicUserProjection.map((field) => [field, true]));

export const GuildBanResponseUserFields = ["username", "discriminator", "id", "avatar", "public_flags"] as const;

export function toGuildBanResponse(reason: string | null | undefined, user: PublicUser): GuildBanResponse {
    return {
        reason: reason ?? null,
        user: {
            username: user.username,
            discriminator: user.discriminator,
            id: user.id,
            avatar: user.avatar ?? null,
            public_flags: user.public_flags,
        },
    };
}

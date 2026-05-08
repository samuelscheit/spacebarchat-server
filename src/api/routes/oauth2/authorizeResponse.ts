import { AvatarDecorationData } from "@spacebar/schemas";

export interface OAuthAuthorizeBotSource {
    id: string;
    username: string;
    avatar?: string | null;
    avatar_decoration_data?: AvatarDecorationData | null;
    discriminator: string;
    public_flags: number;
}

export function toOAuthAuthorizeBot(user: OAuthAuthorizeBotSource) {
    return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        avatar_decoration_data: user.avatar_decoration_data ?? null,
        discriminator: user.discriminator,
        public_flags: user.public_flags,
        bot: true,
    };
}

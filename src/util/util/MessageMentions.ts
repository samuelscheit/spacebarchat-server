import { PartialUser } from "@spacebar/schemas";

const MessageMentionUserProjection = [
    "id",
    "username",
    "discriminator",
    "global_name",
    "avatar",
    "avatar_decoration_data",
    "collectibles",
    "display_name_styles",
    "primary_guild",
    "bot",
    "system",
    "banner",
    "accent_color",
    "public_flags",
] satisfies (keyof PartialUser)[];

export function toMessageMentionUser(user: object): PartialUser {
    const source = user as Record<keyof PartialUser, unknown>;
    const partialUser = {} as PartialUser;

    for (const key of MessageMentionUserProjection) {
        if (source[key] !== undefined) {
            partialUser[key] = source[key] as never;
        }
    }

    if (partialUser.avatar === undefined) partialUser.avatar = null;

    return partialUser;
}

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PublicMemberProjection, type PublicMember, type PublicMemberKeys } from "./Member";

const representativePublicMember = {
    id: "user-id",
    guild_id: "guild-id",
    nick: "display name",
    roles: ["role-id"],
    joined_at: new Date("2026-01-02T03:04:05.000Z"),
    pending: false,
    deaf: false,
    mute: false,
    premium_since: undefined,
    avatar: "avatar-hash",
    banner: "banner-hash",
    bio: "member bio",
    theme_colors: [1, 2],
    pronouns: "they/them",
    communication_disabled_until: null,
    avatar_decoration_data: { asset: "decoration", sku_id: "sku-id", expires_at: null },
    display_name_styles: { font_id: 1, effect_id: 2, colors: [1, 2] },
    collectibles: {
        nameplate: {
            asset: "plate",
            sku_id: "sku-id",
            label: "label",
            palette: "blue",
            expires_at: null,
        },
    },
    flags: 0,
    user: {
        id: "user-id",
        username: "username",
        discriminator: "0001",
        public_flags: 0,
        avatar: "user-avatar",
        accent_color: undefined,
        banner: undefined,
        bio: "user bio",
        bot: false,
        premium_since: null,
        premium_type: 0,
        theme_colors: undefined,
        pronouns: "they/them",
        badge_ids: [],
        avatar_decoration_data: undefined,
        display_name_styles: undefined,
        collectibles: undefined,
        primary_guild: undefined,
    },
} satisfies PublicMember;

describe("PublicMember schema", () => {
    test("projection remains covered by the explicit API member shape", () => {
        const projected: Pick<PublicMember, PublicMemberKeys> = Object.fromEntries(PublicMemberProjection.map((key) => [key, representativePublicMember[key]])) as Pick<
            PublicMember,
            PublicMemberKeys
        >;

        assert.deepEqual(Object.keys(projected).sort(), [...PublicMemberProjection].sort());
        assert.deepEqual(projected.roles, ["role-id"]);
    });
});

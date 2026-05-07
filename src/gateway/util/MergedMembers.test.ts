import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PublicMemberProjection, type PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import { MemberPrivateProjection } from "../../util/entities/MemberProjection";
import { memberToPublicMember } from "../../util/entities/MemberPublic";
import { toReadyMergedMember } from "./MergedMembers";

const memberProfileFields = ["avatar_decoration_data", "display_name_styles", "collectibles"] as const;

type MemberProfileField = (typeof memberProfileFields)[number];

const memberProfileValues = {
    avatar_decoration_data: { asset: "decoration", sku_id: "sku", expires_at: null },
    display_name_styles: { font_id: 1, effect_id: 2, colors: [1, 2] },
    collectibles: {
        nameplate: {
            asset: "plate",
            sku_id: "sku",
            label: "label",
            palette: "blue",
            expires_at: null,
        },
    },
} satisfies Pick<PublicMember, MemberProfileField>;

describe("READY merged_members", () => {
    test("uses the public member shape and preserves profile fields", () => {
        const user = { id: "user-id", username: "jank", avatar: "user-avatar" } as PublicUser;
        const member = {
            guild: { id: "guild-id" },
            roles: [{ id: "guild-id" }, { id: "role-id" }],
            toPublicMember: () =>
                ({
                    id: "user-id",
                    guild_id: "guild-id",
                    avatar: "member-avatar",
                    banner: "member-banner",
                    bio: "member bio",
                    pronouns: "they/them",
                    ...memberProfileValues,
                    roles: ["guild-id", "role-id"],
                }) as PublicMember,
        };

        assert.deepEqual(toReadyMergedMember(member, user), {
            id: "user-id",
            guild_id: "guild-id",
            avatar: "member-avatar",
            banner: "member-banner",
            bio: "member bio",
            pronouns: "they/them",
            ...memberProfileValues,
            roles: ["role-id"],
            user,
            guild: {
                id: "guild-id",
            },
            settings: undefined,
        });
    });

    test("preserves profile fields from the shared Member public projection", () => {
        const user = { id: "user-id", username: "jank", avatar: "user-avatar" } as PublicUser;
        const member = {
            id: "user-id",
            guild_id: "guild-id",
            guild: { id: "guild-id" },
            roles: [{ id: "guild-id" }, { id: "role-id" }],
            avatar: "member-avatar",
            banner: "member-banner",
            bio: "member bio",
            pronouns: "they/them",
            ...memberProfileValues,
            toPublicMember() {
                return memberToPublicMember(this);
            },
        };

        const readyMember = toReadyMergedMember(member, user);

        assert.deepEqual(
            {
                avatar_decoration_data: readyMember.avatar_decoration_data,
                display_name_styles: readyMember.display_name_styles,
                collectibles: readyMember.collectibles,
            },
            memberProfileValues,
        );
        assert.deepEqual(readyMember.roles, ["role-id"]);
        assert.equal(readyMember.user, user);
        assert.deepEqual(readyMember.guild, { id: "guild-id" });
        assert.equal(readyMember.settings, undefined);
    });

    test("select and public projections include profile fields", () => {
        for (const field of memberProfileFields) {
            assert.ok(PublicMemberProjection.includes(field), `${field} missing from PublicMemberProjection`);
            assert.ok(MemberPrivateProjection.includes(field), `${field} missing from MemberPrivateProjection`);
        }
    });
});

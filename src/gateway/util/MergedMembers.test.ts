import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PublicMember, PublicUser } from "@spacebar/schemas";
import { toReadyMergedMember } from "./MergedMembers";

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
                    avatar_decoration_data: { asset: "decoration", sku_id: "sku", expires_at: null },
                    display_name_styles: { font_id: 1, effect_id: 2, colors: [1, 2] },
                    collectibles: { nameplate: { asset: "plate", sku_id: "sku", label: "label", palette: "blue", expires_at: null } },
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
            avatar_decoration_data: { asset: "decoration", sku_id: "sku", expires_at: null },
            display_name_styles: { font_id: 1, effect_id: 2, colors: [1, 2] },
            collectibles: { nameplate: { asset: "plate", sku_id: "sku", label: "label", palette: "blue", expires_at: null } },
            roles: ["role-id"],
            user,
            guild: {
                id: "guild-id",
            },
            settings: undefined,
        });
    });
});

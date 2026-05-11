/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Permissions } from "@spacebar/util/util/Permissions";
import { serializeCurrentGuildMember, type CurrentGuildMemberSource } from "./CurrentGuildMember";

describe("serializeCurrentGuildMember", () => {
    test("returns the current member with guild permission bitfield", () => {
        const member = memberFixture({
            roles: [
                { id: "guild-id", permissions: "1" },
                { id: "role-id", permissions: "4" },
            ],
        });

        assert.deepEqual(serializeCurrentGuildMember(member), {
            ...member.toPublicMember(),
            permissions: "5",
        });
    });

    test("returns administrator permissions for the guild owner", () => {
        const member = memberFixture({
            id: "owner-id",
            guild: { id: "guild-id", owner_id: "owner-id" },
            roles: [{ id: "guild-id", permissions: "0" }],
        });

        assert.equal(serializeCurrentGuildMember(member).permissions, Permissions.ALL.bitfield.toString());
    });
});

function memberFixture({
    id = "user-id",
    guild = { id: "guild-id", owner_id: "owner-id" },
    roles = [{ id: "guild-id", permissions: "1" }],
    flags = 0,
}: {
    id?: string;
    guild?: CurrentGuildMemberSource["guild"];
    roles?: NonNullable<CurrentGuildMemberSource["roles"]>;
    flags?: number;
} = {}): CurrentGuildMemberSource {
    return {
        id,
        guild_id: guild.id,
        guild,
        roles,
        user: { id, flags },
        communication_disabled_until: null,
        toPublicMember() {
            return {
                id,
                guild_id: guild.id,
                nick: "display name",
                roles: roles.map((role) => role.id),
                joined_at: new Date("2026-01-02T03:04:05.000Z"),
                pending: false,
                deaf: false,
                mute: false,
                premium_since: undefined,
                avatar: undefined,
                banner: "",
                bio: "",
                theme_colors: undefined,
                pronouns: "",
                communication_disabled_until: null,
                avatar_decoration_data: undefined,
                display_name_styles: undefined,
                collectibles: undefined,
                flags: 0,
                user: {
                    id,
                    username: "username",
                    discriminator: "0001",
                    public_flags: 0,
                    avatar: undefined,
                    accent_color: undefined,
                    banner: undefined,
                    bio: "",
                    bot: false,
                    premium_since: null,
                    premium_type: 0,
                    theme_colors: undefined,
                    pronouns: "",
                    badge_ids: [],
                    avatar_decoration_data: undefined,
                    display_name_styles: undefined,
                    collectibles: undefined,
                    primary_guild: undefined,
                },
            };
        },
    };
}

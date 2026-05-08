import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Permissions } from "@spacebar/util/util/Permissions";
import { serializeUserGuilds } from "./UserGuilds";

describe("serializeUserGuilds", () => {
    test("returns joined guilds unchanged when counts are not requested", () => {
        const guild = guildFixture({ id: "guild-id" });

        assert.deepEqual(
            serializeUserGuilds(
                [
                    {
                        id: "user-id",
                        guild,
                        roles: [{ id: "role-id", permissions: "1" }],
                    },
                ],
                false,
            ),
            [guild],
        );
    });

    test("adds approximate counts and user role permissions when counts are requested", () => {
        assert.deepEqual(
            serializeUserGuilds(
                [
                    {
                        id: "user-id",
                        guild: guildFixture({ id: "guild-id", member_count: 12, presence_count: 3 }),
                        roles: [
                            { id: "guild-id", permissions: "1" },
                            { id: "role-id", permissions: "4" },
                        ],
                    },
                ],
                true,
            ),
            [
                {
                    id: "guild-id",
                    name: "Guild guild-id",
                    approximate_member_count: 12,
                    approximate_presence_count: 3,
                    permissions: "5",
                },
            ],
        );
    });

    test("defaults missing counts and roles to zero", () => {
        assert.deepEqual(
            serializeUserGuilds(
                [
                    {
                        id: "user-id",
                        guild: guildFixture({ id: "guild-id" }),
                    },
                ],
                true,
            ),
            [
                {
                    id: "guild-id",
                    name: "Guild guild-id",
                    approximate_member_count: 0,
                    approximate_presence_count: 0,
                    permissions: "0",
                },
            ],
        );
    });

    test("returns administrator permissions for guild owners", () => {
        assert.deepEqual(
            serializeUserGuilds(
                [
                    {
                        id: "owner-id",
                        guild: guildFixture({ id: "guild-id", owner_id: "owner-id" }),
                        roles: [{ id: "guild-id", permissions: "0" }],
                    },
                ],
                true,
            ),
            [
                {
                    id: "guild-id",
                    name: "Guild guild-id",
                    approximate_member_count: 0,
                    approximate_presence_count: 0,
                    permissions: Permissions.ALL.bitfield.toString(),
                },
            ],
        );
    });
});

function guildFixture({
    id,
    owner_id = "owner-id",
    member_count,
    presence_count,
}: {
    id: string;
    owner_id?: string;
    member_count?: number;
    presence_count?: number;
}) {
    return {
        id,
        owner_id,
        member_count,
        presence_count,
        toJSON() {
            return {
                id,
                name: `Guild ${id}`,
            };
        },
    };
}

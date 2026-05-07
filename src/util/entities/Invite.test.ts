import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const { DiscordApiErrors, Invite, Member } = require("@spacebar/util") as typeof import("@spacebar/util");

describe("guild invite acceptance", () => {
    test("rejects non-guild invites before consuming them", async () => {
        const invite = {
            code: "friend1",
            guild_id: undefined,
            uses: 0,
            max_uses: 5,
            isExpired: () => false,
            save: async () => {
                throw new Error("should not save a non-guild invite");
            },
        };

        await assert.rejects(
            () => Invite.acceptGuildInvite("new_user", invite as never),
            (error) => (error as { code?: number }).code === DiscordApiErrors.UNKNOWN_INVITE.code,
        );
        assert.equal(invite.uses, 0);
    });

    test("deletes a final-use guild invite after incrementing its use count", async () => {
        const inviteClass = Invite as unknown as {
            deleteWithVanityUrlFeatureSync: (invites: unknown, opts?: { emitDeleteEvents?: boolean }) => Promise<unknown[]>;
        };
        const memberClass = Member as unknown as {
            addToGuild: (user_id: string, guild_id: string) => Promise<unknown>;
        };
        const originalDeleteWithVanityUrlFeatureSync = inviteClass.deleteWithVanityUrlFeatureSync;
        const originalAddToGuild = memberClass.addToGuild;
        const deletedUses: number[] = [];
        const guildAdds: { user_id: string; guild_id: string }[] = [];
        const invite = {
            code: "guild1",
            guild_id: "guild_id",
            channel_id: "channel_id",
            uses: 0,
            max_uses: 1,
            isExpired: () => false,
            save: async () => {
                throw new Error("should delete instead of saving the last use");
            },
        };

        try {
            inviteClass.deleteWithVanityUrlFeatureSync = async (deletedInvite) => {
                deletedUses.push((deletedInvite as { uses: number }).uses);
                return [];
            };
            memberClass.addToGuild = async (user_id, guild_id) => {
                guildAdds.push({ user_id, guild_id });
            };

            await Invite.acceptGuildInvite("new_user", invite as never);
        } finally {
            inviteClass.deleteWithVanityUrlFeatureSync = originalDeleteWithVanityUrlFeatureSync;
            memberClass.addToGuild = originalAddToGuild;
        }

        assert.equal(invite.uses, 1);
        assert.deepEqual(deletedUses, [1]);
        assert.deepEqual(guildAdds, [{ user_id: "new_user", guild_id: "guild_id" }]);
    });

    test("removes expired guild invites through the vanity-aware delete path", async () => {
        const inviteClass = Invite as unknown as {
            delete: (criteria: unknown) => Promise<unknown>;
            deleteWithVanityUrlFeatureSync: (invites: unknown, opts?: { emitDeleteEvents?: boolean }) => Promise<unknown[]>;
        };
        const memberClass = Member as unknown as {
            addToGuild: (user_id: string, guild_id: string) => Promise<unknown>;
        };
        const originalDelete = inviteClass.delete;
        const originalDeleteWithVanityUrlFeatureSync = inviteClass.deleteWithVanityUrlFeatureSync;
        const originalAddToGuild = memberClass.addToGuild;
        const rawDeletes: unknown[] = [];
        const vanityDeletes: string[] = [];
        const invite = {
            code: "expired",
            guild_id: "guild_id",
            uses: 0,
            max_uses: 5,
            isExpired: () => true,
            save: async () => {
                throw new Error("should not save an expired invite");
            },
        };

        try {
            inviteClass.delete = async (criteria) => {
                rawDeletes.push(criteria);
                return {};
            };
            inviteClass.deleteWithVanityUrlFeatureSync = async (deletedInvite) => {
                vanityDeletes.push((deletedInvite as { code: string }).code);
                return [];
            };
            memberClass.addToGuild = async () => {
                throw new Error("should not add a member for an expired invite");
            };

            await assert.rejects(() => Invite.acceptGuildInvite("new_user", invite as never), /Invite is expired/);
        } finally {
            inviteClass.delete = originalDelete;
            inviteClass.deleteWithVanityUrlFeatureSync = originalDeleteWithVanityUrlFeatureSync;
            memberClass.addToGuild = originalAddToGuild;
        }

        assert.equal(invite.uses, 0);
        assert.deepEqual(rawDeletes, []);
        assert.deepEqual(vanityDeletes, ["expired"]);
    });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const { DiscordApiErrors, Invite } = require("@spacebar/util") as typeof import("@spacebar/util");

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
});

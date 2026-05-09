import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Guild } from "./Guild";

describe("Channel.getUserPermissions", () => {
    test("short-circuits supplied guild owners before member and role lookups", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";

        const [{ Channel }, { Member }, { User }, { Permissions }] = await Promise.all([
            import("./Channel.js"),
            import("./Member.js"),
            import("./User.js"),
            import("../util/Permissions.js"),
        ]);
        const memberClass = Member as unknown as {
            findOneOrFail: (options: unknown) => Promise<unknown>;
        };
        const userClass = User as unknown as {
            findOneOrFail: (options: unknown) => Promise<unknown>;
        };

        let memberLookups = 0;
        let userLookups = 0;

        t.mock.method(memberClass, "findOneOrFail", async () => {
            memberLookups += 1;
            throw new Error("owner permissions should not require a guild member row");
        });
        t.mock.method(userClass, "findOneOrFail", async () => {
            userLookups += 1;
            throw new Error("owner permissions should not require role-related user lookups");
        });

        const channel = new Channel();
        channel.type = 0;
        channel.guild_id = "guild_id";

        const permissions = await channel.getUserPermissions({
            user_id: "owner_id",
            guild: { id: "guild_id", owner_id: "owner_id" } as Guild,
        });

        assert.equal(permissions.bitfield, Permissions.ALL.bitfield);
        assert.equal(memberLookups, 0);
        assert.equal(userLookups, 0);
    });
});

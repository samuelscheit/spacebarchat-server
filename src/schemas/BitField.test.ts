import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BitField } from "./BitField";
import { UserFlags } from "./api/users/User";
import { BitField as UtilBitField } from "../util/util/BitField";

describe("schema BitField", () => {
    test("preserves UserFlags resolution from schema-owned BitField", () => {
        const flags = new UserFlags(["DISCORD_EMPLOYEE", "ACTIVE_DEVELOPER"]);

        assert.equal(flags instanceof BitField, true);
        assert.equal(flags.has("DISCORD_EMPLOYEE"), true);
        assert.equal(flags.has("ACTIVE_DEVELOPER"), true);
        assert.equal(flags.has("SPAMMER"), false);
        assert.equal(flags.bitfield, UserFlags.FLAGS.DISCORD_EMPLOYEE | UserFlags.FLAGS.ACTIVE_DEVELOPER);
    });

    test("keeps the util BitField import path as a compatibility re-export", () => {
        assert.equal(UtilBitField, BitField);
    });
});

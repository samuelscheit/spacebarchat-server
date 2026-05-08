import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BitField } from "./BitField";
import { UserFlags } from "./api/users/User";
import { BitField as UtilBarrelBitField } from "../util";
import { BitField as UtilBitField } from "../util/util/BitField";

describe("schema BitField", () => {
    test("preserves UserFlags resolution from schema-owned BitField", () => {
        const flags = new UserFlags(["DISCORD_EMPLOYEE", "ACTIVE_DEVELOPER"]);

        assert.equal(flags instanceof BitField, true);
        assert.equal(flags.has("DISCORD_EMPLOYEE"), true);
        assert.equal(flags.has("ACTIVE_DEVELOPER"), true);
        assert.equal(flags.has("SPAMMER"), false);
        assert.equal(flags.bitfield, UserFlags.FLAGS.DISCORD_EMPLOYEE | UserFlags.FLAGS.ACTIVE_DEVELOPER);
        assert.deepEqual(flags.toArray(), ["DISCORD_EMPLOYEE", "ACTIVE_DEVELOPER"]);
        assert.equal(flags.serialize().DISCORD_EMPLOYEE, true);
        assert.equal(flags.serialize().SPAMMER, false);
        assert.deepEqual(flags.missing(UserFlags.FLAGS.DISCORD_EMPLOYEE | UserFlags.FLAGS.SPAMMER), ["SPAMMER"]);
    });

    test("keeps the util BitField import path as a compatibility re-export", () => {
        assert.equal(UtilBitField, BitField);
        assert.equal(UtilBarrelBitField, BitField);
    });

    test("preserves subclasses when mutating frozen schema bitfields", () => {
        const flags = new UserFlags("DISCORD_EMPLOYEE");
        flags.freeze();

        const withActiveDeveloper = flags.add("ACTIVE_DEVELOPER");
        const withoutEmployee = flags.remove("DISCORD_EMPLOYEE");

        assert.equal(withActiveDeveloper instanceof UserFlags, true);
        assert.deepEqual(withActiveDeveloper.toArray(), ["DISCORD_EMPLOYEE", "ACTIVE_DEVELOPER"]);
        assert.equal(withoutEmployee instanceof UserFlags, true);
        assert.deepEqual(withoutEmployee.toArray(), []);
    });
});

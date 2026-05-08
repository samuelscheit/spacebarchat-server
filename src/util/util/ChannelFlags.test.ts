import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChannelFlags, hasChannelSpamFlag } from "./ChannelFlags";

describe("hasChannelSpamFlag", () => {
    it("returns false when no channel flags are present", () => {
        assert.equal(hasChannelSpamFlag(0), false);
        assert.equal(hasChannelSpamFlag(undefined), false);
        assert.equal(hasChannelSpamFlag(null), false);
    });

    it("returns true when the channel has the spam flag", () => {
        assert.equal(hasChannelSpamFlag(Number(ChannelFlags.FLAGS.IS_SPAM)), true);
        assert.equal(hasChannelSpamFlag(ChannelFlags.FLAGS.IS_SPAM), true);
    });

    it("ignores unrelated channel flags", () => {
        assert.equal(hasChannelSpamFlag(Number(ChannelFlags.FLAGS.PINNED)), false);
    });

    it("returns true when the spam flag is combined with other channel flags", () => {
        const flags = Number(ChannelFlags.FLAGS.IS_SPAM | ChannelFlags.FLAGS.PINNED);

        assert.equal(hasChannelSpamFlag(flags), true);
    });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChannelFlags } from "@spacebar/util";
import { isReadyPrivateChannelSpam } from "./Identify";

describe("isReadyPrivateChannelSpam", () => {
    it("returns false when no channel flags are present", () => {
        assert.equal(isReadyPrivateChannelSpam(0), false);
        assert.equal(isReadyPrivateChannelSpam(undefined), false);
        assert.equal(isReadyPrivateChannelSpam(null), false);
    });

    it("returns true when the channel has the spam flag", () => {
        assert.equal(isReadyPrivateChannelSpam(Number(ChannelFlags.FLAGS.IS_SPAM)), true);
    });

    it("ignores unrelated channel flags", () => {
        assert.equal(isReadyPrivateChannelSpam(Number(ChannelFlags.FLAGS.PINNED)), false);
    });
});

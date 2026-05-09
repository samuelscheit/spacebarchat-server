import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MessageFlags, withThreadMessageFlag } from "./MessageFlags";

const hasThreadFlag = Number(MessageFlags.FLAGS.HAS_THREAD);

describe("withThreadMessageFlag", () => {
    test("sets HAS_THREAD when no flags are present", () => {
        assert.equal(withThreadMessageFlag(0), hasThreadFlag);
        assert.equal(withThreadMessageFlag(undefined), hasThreadFlag);
        assert.equal(withThreadMessageFlag(null), hasThreadFlag);
    });

    test("preserves existing flags while setting HAS_THREAD", () => {
        const suppressEmbeds = Number(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
        const urgent = Number(MessageFlags.FLAGS.URGENT);

        assert.equal(withThreadMessageFlag(suppressEmbeds), suppressEmbeds | hasThreadFlag);
        assert.equal(withThreadMessageFlag(suppressEmbeds | urgent), suppressEmbeds | urgent | hasThreadFlag);
    });

    test("leaves HAS_THREAD set when it is already present", () => {
        const existingFlags = Number(MessageFlags.FLAGS.IS_CROSSPOST) | hasThreadFlag;

        assert.equal(withThreadMessageFlag(existingFlags), existingFlags);
    });
});

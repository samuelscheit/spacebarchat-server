import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ExactArray, instanceOf } from "./check";

describe("instanceOf array validation", () => {
    test("allows an optional typed array property to be absent", () => {
        assert.equal(instanceOf({ $items: [Number] }, {}), true);
    });

    test("rejects null entries in a present optional typed array property", () => {
        assert.throws(() => instanceOf({ $items: [Number] }, { items: [1, null] }), /.items\[1\] is required/);
    });

    test("allows an optional exact array property to be absent", () => {
        assert.equal(instanceOf({ $size: new ExactArray(Number, Number) }, {}), true);
    });

    test("rejects null entries in a present optional exact array property", () => {
        assert.throws(() => instanceOf({ $size: new ExactArray(Number, Number) }, { size: [1, null] }), /.size\[1\] is required/);
    });
});

describe("instanceOf object property aliases", () => {
    test("allows any alias declared in a schema key", () => {
        const schema = { "$[client_state|clientState]": { "$[guild_hashes|guildHashes]": Object } };

        assert.equal(instanceOf(schema, { client_state: { guild_hashes: {} } }), true);
        assert.equal(instanceOf(schema, { clientState: { guildHashes: {} } }), true);
    });

    test("keeps alias properties optional when prefixed", () => {
        assert.equal(instanceOf({ "$[large_threshold|largeThreshold]": Number }, {}), true);
    });

    test("requires alias properties when no optional prefix is present", () => {
        assert.equal(instanceOf({ "[user_id|userId]": String }, { userId: "1" }), true);
        assert.throws(() => instanceOf({ "[user_id|userId]": String }, {}), /.user_id is required/);
    });

    test("rejects unknown aliases", () => {
        assert.throws(() => instanceOf({ "$[large_threshold|largeThreshold]": Number }, { largeTHRESHOLD: 50 }), /Unknown key largeTHRESHOLD/);
    });

    test("rejects payloads that provide more than one alias for the same property", () => {
        assert.throws(
            () => instanceOf({ "$[large_threshold|largeThreshold]": Number }, { large_threshold: 50, largeThreshold: 50 }),
            /.large_threshold must only use one of large_threshold, largeThreshold/,
        );
    });

    test("rejects payloads that provide more than one nested alias for the same property", () => {
        const schema = { "$[client_state|clientState]": { "$[guild_hashes|guildHashes]": Object } };

        assert.throws(() => instanceOf(schema, { clientState: { guild_hashes: {}, guildHashes: {} } }), /.clientState.guild_hashes must only use one of guild_hashes, guildHashes/);
    });
});

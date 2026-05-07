import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const ChannelType = {
    GUILD_TEXT: 0,
    GUILD_VOICE: 2,
    GUILD_CATEGORY: 4,
    GUILD_NEWS: 5,
    GUILD_PUBLIC_THREAD: 11,
    GUILD_FORUM: 15,
    UNHANDLED: 255,
} as const;

function getSchema(name: string) {
    const validate = ajv.getSchema(name);
    assert.ok(validate, `${name} must be registered`);
    return validate;
}

describe("ChannelModifySchema", () => {
    test("only accepts text and news type conversions", () => {
        const validate = getSchema("ChannelModifySchema");

        assert.equal(validate({ type: ChannelType.GUILD_TEXT }), true);
        assert.equal(validate({ type: ChannelType.GUILD_NEWS }), true);
        assert.equal(validate({ type: ChannelType.GUILD_VOICE }), false);
        assert.equal(validate({ type: ChannelType.GUILD_CATEGORY }), false);
        assert.equal(validate({ type: ChannelType.GUILD_PUBLIC_THREAD }), false);
        assert.equal(validate({ type: ChannelType.GUILD_FORUM }), false);
        assert.equal(validate({ type: ChannelType.UNHANDLED }), false);
    });

    test("keeps parent_id null when removing a channel from a category", () => {
        const validate = getSchema("ChannelModifySchema");

        const payload = { parent_id: null };
        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
        assert.equal(payload.parent_id, null);
    });

    test("allows string parent_id values", () => {
        const validate = getSchema("ChannelModifySchema");

        const payload = { parent_id: "123" };
        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
        assert.equal(payload.parent_id, "123");
    });
});

describe("ChannelCreateSchema", () => {
    test("keeps full channel type creation support", () => {
        const validate = getSchema("ChannelCreateSchema");

        assert.equal(validate({ name: "voice", type: ChannelType.GUILD_VOICE }), true);
        assert.equal(validate({ name: "forum", type: ChannelType.GUILD_FORUM }), true);
    });
});

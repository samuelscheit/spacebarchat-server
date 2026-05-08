import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const ChannelType = {
    GUILD_TEXT: 0,
    GUILD_VOICE: 2,
    GUILD_CATEGORY: 4,
    GUILD_NEWS: 5,
    DM: 1,
    GROUP_DM: 3,
    GUILD_NEWS_THREAD: 10,
    GUILD_PUBLIC_THREAD: 11,
    GUILD_PRIVATE_THREAD: 12,
    GUILD_FORUM: 15,
    GUILD_MEDIA: 16,
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
    test("keeps ordinary guild channel type creation support", () => {
        const validate = getSchema("ChannelCreateSchema");

        assert.equal(validate({ name: "voice", type: ChannelType.GUILD_VOICE }), true);
        assert.equal(validate({ name: "forum", type: ChannelType.GUILD_FORUM }), true);
        assert.equal(validate({ name: "media", type: ChannelType.GUILD_MEDIA }), true);
    });

    test("rejects channel types that have dedicated creation routes", () => {
        const validate = getSchema("ChannelCreateSchema");

        assert.equal(validate({ name: "dm", type: ChannelType.DM }), false);
        assert.equal(validate({ name: "group", type: ChannelType.GROUP_DM }), false);
        assert.equal(validate({ name: "news-thread", type: ChannelType.GUILD_NEWS_THREAD }), false);
        assert.equal(validate({ name: "public-thread", type: ChannelType.GUILD_PUBLIC_THREAD }), false);
        assert.equal(validate({ name: "private-thread", type: ChannelType.GUILD_PRIVATE_THREAD }), false);
    });
});

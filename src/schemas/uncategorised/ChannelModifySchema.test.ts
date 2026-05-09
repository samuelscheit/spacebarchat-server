import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const ChannelType = {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_NEWS: 5,
    GUILD_STORE: 6,
    GUILD_LFG: 7,
    LFG_GROUP_DM: 8,
    THREAD_ALPHA: 9,
    GUILD_NEWS_THREAD: 10,
    GUILD_PUBLIC_THREAD: 11,
    GUILD_PRIVATE_THREAD: 12,
    GUILD_STAGE_VOICE: 13,
    GUILD_DIRECTORY: 14,
    GUILD_FORUM: 15,
    GUILD_MEDIA: 16,
    LOBBY: 17,
    EPHEMERAL_DM: 18,
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

    test("allows available_tags entries with and without ids", () => {
        const validate = getSchema("ChannelModifySchema");

        assert.equal(
            validate({
                available_tags: [
                    { id: "existing-tag", name: "Existing", moderated: true, emoji_name: "🔥" },
                    { name: "New", moderated: false },
                ],
            }),
            true,
            JSON.stringify(validate.errors),
        );
    });

    test("keeps generated OpenAPI available_tags entries id-less for new tags", () => {
        const openApiPath = path.join(process.cwd(), "assets/openapi.json");
        const openApi = JSON.parse(readFileSync(openApiPath, "utf8")) as {
            components: {
                schemas: {
                    ChannelModifySchema: {
                        properties: {
                            available_tags: {
                                items: {
                                    required?: string[];
                                };
                            };
                        };
                    };
                };
            };
        };

        assert.deepEqual(openApi.components.schemas.ChannelModifySchema.properties.available_tags.items.required, ["name"]);
    });
});

describe("ChannelCreateSchema", () => {
    test("keeps ordinary guild channel type creation support", () => {
        const validate = getSchema("ChannelCreateSchema");

        assert.equal(validate({ name: "text", type: ChannelType.GUILD_TEXT }), true);
        assert.equal(validate({ name: "voice", type: ChannelType.GUILD_VOICE }), true);
        assert.equal(validate({ name: "category", type: ChannelType.GUILD_CATEGORY }), true);
        assert.equal(validate({ name: "news", type: ChannelType.GUILD_NEWS }), true);
        assert.equal(validate({ name: "stage", type: ChannelType.GUILD_STAGE_VOICE }), true);
        assert.equal(validate({ name: "forum", type: ChannelType.GUILD_FORUM }), true);
        assert.equal(validate({ name: "media", type: ChannelType.GUILD_MEDIA }), true);
        assert.equal(validate({ name: "unhandled", type: ChannelType.UNHANDLED }), true);
    });

    test("rejects channel types that have dedicated creation routes", () => {
        const validate = getSchema("ChannelCreateSchema");

        assert.equal(validate({ name: "dm", type: ChannelType.DM }), false);
        assert.equal(validate({ name: "group", type: ChannelType.GROUP_DM }), false);
        assert.equal(validate({ name: "news-thread", type: ChannelType.GUILD_NEWS_THREAD }), false);
        assert.equal(validate({ name: "public-thread", type: ChannelType.GUILD_PUBLIC_THREAD }), false);
        assert.equal(validate({ name: "private-thread", type: ChannelType.GUILD_PRIVATE_THREAD }), false);
    });

    test("rejects unsupported or deprecated channel types", () => {
        const validate = getSchema("ChannelCreateSchema");

        for (const type of [
            ChannelType.GUILD_STORE,
            ChannelType.GUILD_LFG,
            ChannelType.LFG_GROUP_DM,
            ChannelType.THREAD_ALPHA,
            ChannelType.GUILD_DIRECTORY,
            ChannelType.LOBBY,
            ChannelType.EPHEMERAL_DM,
        ]) {
            assert.equal(validate({ name: `unsupported-${type}`, type }), false, `type ${type} should be rejected`);
        }
    });
});

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import { getAuthorizingIntegrationOwners } from "./InteractionCreateSchema";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const interactionCreateSchema = {
    ...(schemas.InteractionCreateSchema as Record<string, unknown>),
    definitions: schemas,
};

function compileInteractionCreateSchema() {
    return new Ajv({ strict: false, validateFormats: false, validateSchema: false }).compile(interactionCreateSchema);
}

function baseInteractionPayload() {
    return {
        version: 1,
        id: "100000000000000001",
        application_id: "100000000000000002",
        token: "interaction-token",
        app_permissions: "0",
        attachment_size_limit: 26214400,
        context: 0,
        authorizing_integration_owners: {
            "0": "100000000000000003",
        },
        entitlements: [
            {
                id: "100000000000000006",
                sku_id: "100000000000000007",
                application_id: "100000000000000002",
                user_id: "100000000000000008",
                type: 8,
                deleted: false,
                starts_at: null,
                ends_at: "2026-01-01T00:00:00.000Z",
                consumed: false,
                promotion_id: null,
                gift_code_flags: 0,
                branches: ["100000000000000009"],
                subscription_id: "100000000000000010",
            },
        ],
    };
}

function applicationCommandInteractionPayload() {
    return {
        ...baseInteractionPayload(),
        type: 2,
        data: {
            id: "100000000000000004",
            name: "ping",
            type: 1,
            guild_id: "100000000000000003",
            options: [
                {
                    name: "term",
                    type: 3,
                    value: "spacebar",
                },
            ],
            resolved: {
                users: {
                    "100000000000000008": {
                        id: "100000000000000008",
                        username: "tester",
                        discriminator: "0001",
                        avatar: null,
                    },
                },
            },
        },
    };
}

describe("InteractionCreateSchema", () => {
    test("accepts Discord-compatible application command interactions", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate(applicationCommandInteractionPayload()), true, JSON.stringify(validate.errors));
    });

    test("accepts Discord-compatible message component interactions", () => {
        const validate = compileInteractionCreateSchema();
        const payload = {
            ...baseInteractionPayload(),
            type: 3,
            data: {
                custom_id: "select_bug",
                component_type: 3,
                values: ["butterfly"],
                resolved: {
                    channels: {
                        "100000000000000011": {
                            id: "100000000000000011",
                            name: "general",
                            type: 0,
                        },
                    },
                },
            },
        };

        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
    });

    test("accepts Discord-compatible modal submit interactions", () => {
        const validate = compileInteractionCreateSchema();
        const payload = {
            ...baseInteractionPayload(),
            type: 5,
            data: {
                custom_id: "bug_modal",
                components: [
                    {
                        type: 18,
                        id: 1,
                        component: {
                            type: 3,
                            id: 2,
                            custom_id: "favorite_bug",
                            values: ["butterfly"],
                        },
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "description",
                                value: "Buttons stop responding.",
                            },
                        ],
                    },
                ],
                resolved: {
                    attachments: {
                        "100000000000000012": {
                            id: "100000000000000012",
                            filename: "bug.png",
                        },
                    },
                },
            },
        };

        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
    });

    test("accepts ping interactions without data", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate({ ...baseInteractionPayload(), type: 1 }), true, JSON.stringify(validate.errors));
    });

    test("rejects obsolete top-level member_id fields", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate({ ...applicationCommandInteractionPayload(), member_id: "100000000000000008" }), false);
    });

    test("accepts guild interactions with a member object", () => {
        const validate = compileInteractionCreateSchema();
        const payload = {
            ...applicationCommandInteractionPayload(),
            guild_id: "100000000000000003",
            guild: {
                id: "100000000000000003",
                features: [],
                locale: "en-US",
            },
            guild_locale: "en-US",
            member: {
                user: {
                    id: "100000000000000008",
                    username: "tester",
                    discriminator: "0001",
                    avatar: "",
                    public_flags: 0,
                    bot: false,
                    bio: "",
                    premium_type: 0,
                },
                id: "100000000000000008",
                guild_id: "100000000000000003",
                roles: [],
                joined_at: "2026-01-01T00:00:00.000Z",
                pending: false,
                deaf: false,
                mute: false,
                flags: 0,
                banner: "",
                bio: "",
                communication_disabled_until: null,
            },
        };

        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
    });

    test("rejects interactions outside the typed contract", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate({ ...applicationCommandInteractionPayload(), version: 2 }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), context: 3 }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), authorizing_integration_owners: { "2": "100000000000000003" } }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), data: { custom_id: "wrong", component_type: 2 } }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), type: 3, data: { custom_id: "select" } }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), type: 5, data: { custom_id: "modal" } }), false);
        assert.equal(validate({ ...applicationCommandInteractionPayload(), entitlements: [{ id: "100000000000000006" }] }), false);
    });

    test("computes authorizing integration owners from the interaction source", () => {
        assert.deepEqual(
            getAuthorizingIntegrationOwners({
                application_id: "100000000000000002",
                channel_id: "100000000000000011",
                guild_id: "100000000000000003",
                user_id: "100000000000000008",
            }),
            { "0": "100000000000000003" },
        );
        assert.deepEqual(
            getAuthorizingIntegrationOwners({
                application_id: "100000000000000002",
                channel_id: "100000000000000002",
                user_id: "100000000000000008",
            }),
            { "0": "0" },
        );
        assert.deepEqual(
            getAuthorizingIntegrationOwners({
                application_id: "100000000000000002",
                channel_id: "100000000000000011",
                user_id: "100000000000000008",
            }),
            { "1": "100000000000000008" },
        );
    });
});

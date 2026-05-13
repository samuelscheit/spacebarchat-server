import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ajv, validateSchema } from "./Validator";
import { ajvErrorsToFieldErrors } from "../api/util/utility/AjvErrorFields";

const PngDataUri = "data:image/png;base64,iVBORw0KGgo=";
const AssetHash = "0123456789abcdef0123456789abcdef";
type JsonShape = {
    $ref?: string;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    type?: string | string[];
    items?: JsonShape;
    properties?: Record<string, JsonShape & { format?: string }>;
};

const Schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), { encoding: "utf8" })) as Record<string, JsonShape>;

const ImageDataUriFields = [
    ["ApplicationModifySchema", "icon"],
    ["ApplicationModifySchema", "cover_image"],
    ["BotModifySchema", "avatar"],
    ["BotModifySchema", "banner"],
    ["ChannelModifySchema", "icon"],
    ["ChannelCreateSchema", "icon"],
    ["EmojiCreateSchema", "image"],
    ["GuildCreateSchema", "icon"],
    ["GuildTemplateCreateSchema", "icon"],
    ["MemberChangeProfileSchema", "banner"],
    ["MemberChangeSchema", "avatar"],
    ["RoleModifySchema", "icon"],
    ["StreamPreviewUploadSchema", "thumbnail"],
    ["UserAvatarModifySchema", "avatar"],
    ["UserModifySchema", "avatar"],
    ["UserModifySchema", "banner"],
    ["UserProfileStyleModifySchema", "banner"],
    ["UserProfileModifySchema", "banner"],
    ["WebhookCreateSchema", "avatar"],
    ["WebhookUpdateSchema", "avatar"],
] as const;

function schemaTypes(schema: JsonShape | undefined): string[] {
    assert.ok(schema);

    if (schema.$ref) {
        const match = /^#\/definitions\/(.+)$/.exec(schema.$ref);
        assert.ok(match, `unexpected schema ref ${schema.$ref}`);
        return schemaTypes(Schemas[match[1]]);
    }

    return (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((type): type is string => typeof type === "string").sort();
}

describe("IdentifySchema", () => {
    test("compiles under strict AJV and accepts JSON-safe gateway bitfields", () => {
        const validate = ajv.getSchema("IdentifySchema");
        assert.ok(validate);

        const payload = {
            token: "auth-token",
            properties: {},
            intents: 0,
            shard: [0, "1"],
        };

        assert.equal(validate(payload), true, JSON.stringify(validate.errors, null, 2));
        assert.equal(payload.intents, 0);
        assert.deepEqual(payload.shard, [0, "1"]);

        const identifySchema = Schemas.IdentifySchema as {
            properties?: {
                intents?: JsonShape;
                shard?: { items?: JsonShape };
            };
        };
        assert.deepEqual(schemaTypes(identifySchema.properties?.intents), ["integer", "string"]);
        assert.deepEqual(schemaTypes(identifySchema.properties?.shard?.items), ["integer", "string"]);
    });
});

describe("WebhookExecuteSchema", () => {
    function getWebhookExecuteValidator() {
        const validate = ajv.getSchema("WebhookExecuteSchema");
        assert.ok(validate);
        return validate;
    }

    test("accepts null webhook optional fields", () => {
        const validate = getWebhookExecuteValidator();

        for (const field of ["embeds", "components", "allowed_mentions", "message_reference", "sticker_ids", "username", "avatar_url"]) {
            const body = {
                content: "bridged message",
                [field]: null,
            };
            const valid = validate(body);

            assert.equal(valid, true, `${field}: ${JSON.stringify(validate.errors, null, 2)}`);
            assert.equal(body[field as keyof typeof body], null);
        }
    });

    test("still rejects non-null embeds with the wrong type", () => {
        const validate = getWebhookExecuteValidator();

        const valid = validate({
            content: "bridged message",
            embeds: {},
        });

        assert.equal(valid, false);
        assert.equal(validate.errors?.[0]?.instancePath, "/embeds");
    });

    test("still rejects non-null components with the wrong type", () => {
        const validate = getWebhookExecuteValidator();

        const valid = validate({
            content: "bridged message",
            components: {},
        });

        assert.equal(valid, false);
        assert.equal(validate.errors?.[0]?.instancePath, "/components");
    });

    test("still rejects other nullable fields with the wrong non-null type", () => {
        const validate = getWebhookExecuteValidator();

        for (const [field, value] of [
            ["allowed_mentions", 1],
            ["message_reference", 1],
            ["sticker_ids", {}],
            ["username", {}],
            ["avatar_url", {}],
        ] as const) {
            const valid = validate({
                content: "bridged message",
                [field]: value,
            });

            assert.equal(valid, false, `${field} should reject ${JSON.stringify(value)}`);
            assert.equal(validate.errors?.[0]?.instancePath, `/${field}`);
        }
    });
});

describe("MessageCreateSchema", () => {
    test("accepts message activity payloads", () => {
        assert.deepEqual(validateSchema("MessageCreateSchema", { content: "join", activity: { type: 1, party_id: "party-id", session_id: "session-id" } }), {
            content: "join",
            activity: { type: 1, party_id: "party-id", session_id: "session-id" },
        });
    });
});

describe("RegisterSchema", () => {
    test("accepts gift_code_sku_id as a registration compatibility field", () => {
        const body = {
            username: "giftuser",
            password: "correct horse battery staple",
            consent: true,
            gift_code_sku_id: "521842865731534868",
        };

        assert.deepEqual(validateSchema("RegisterSchema", body), body);
    });
});

describe("schema validator custom formats", () => {
    test("coerces bigint schema fields from JSON-safe numbers and strings", () => {
        const payload = {
            token: "auth-token",
            properties: {},
            intents: 0,
            shard: [0, "1"],
        };

        assert.equal(validateSchema("IdentifySchema", payload), payload);
        assert.equal(payload.intents, 0n);
        assert.deepEqual(payload.shard, [0n, 1n]);
    });

    test("preserves large bigint strings without precision loss", () => {
        const payload = {
            token: "gateway-token",
            properties: {},
            intents: "9007199254740993",
            shard: ["0", "1"],
        };

        assert.equal(validateSchema("IdentifySchema", payload), payload);
        assert.equal(payload.intents, 9007199254740993n);
        assert.deepEqual(payload.shard, [0n, 1n]);
    });

    test("rejects bigint schema fields that cannot be coerced", () => {
        assert.throws(() =>
            validateSchema("IdentifySchema", {
                token: "auth-token",
                properties: {},
                intents: 1.5,
            }),
        );
        assert.throws(() =>
            validateSchema("IdentifySchema", {
                token: "auth-token",
                properties: {},
                shard: ["not-an-integer"],
            }),
        );
        assert.throws(() =>
            validateSchema("IdentifySchema", {
                token: "gateway-token",
                properties: {},
                intents: "1.5",
            }),
        );
    });

    test("accepts image data URI fields with matching image bytes", () => {
        assert.deepEqual(validateSchema("WebhookCreateSchema", { name: "hook", avatar: PngDataUri }), { name: "hook", avatar: PngDataUri });
        assert.deepEqual(validateSchema("BotModifySchema", { banner: PngDataUri }), { banner: PngDataUri });
        assert.deepEqual(validateSchema("GuildTemplateCreateSchema", { name: "template", icon: PngDataUri }), { name: "template", icon: PngDataUri });
        assert.deepEqual(validateSchema("ChannelCreateSchema", { name: "voice", type: 2, icon: PngDataUri }), { name: "voice", type: 2, icon: PngDataUri });
        assert.deepEqual(validateSchema("RoleModifySchema", { icon: PngDataUri }), { icon: PngDataUri });
        assert.deepEqual(validateSchema("StreamPreviewUploadSchema", { thumbnail: PngDataUri }), { thumbnail: PngDataUri });
    });

    test("rejects image data URI fields with mismatched image bytes", () => {
        assert.throws(() => validateSchema("WebhookCreateSchema", { name: "hook", avatar: "data:image/png;base64,/9j/" }));
        assert.throws(() => validateSchema("BotModifySchema", { banner: AssetHash }));
        assert.throws(() => validateSchema("GuildTemplateCreateSchema", { name: "template", icon: AssetHash }));
        assert.throws(() => validateSchema("StreamPreviewUploadSchema", { thumbnail: AssetHash }));
    });

    test("allows guild update fields to preserve current asset hashes", () => {
        assert.deepEqual(validateSchema("GuildUpdateSchema", { icon: AssetHash, banner: `a_${AssetHash}`, splash: null }), {
            icon: AssetHash,
            banner: `a_${AssetHash}`,
            splash: null,
        });
    });

    test("documents writable guild profile tags", () => {
        assert.deepEqual(Schemas.GuildUpdateSchema.properties?.profile_tag, {
            type: ["null", "string"],
            minLength: 1,
            maxLength: 4,
            pattern: "^[A-Za-z0-9]+$",
        });
    });

    test("keeps upload formats on request fields and off response hash fields", () => {
        for (const [schemaName, field] of ImageDataUriFields) {
            assert.equal(Schemas[schemaName].properties?.[field]?.format, "image-data-uri", `${schemaName}.${field}`);
        }

        for (const field of ["icon", "banner", "splash", "discovery_splash"]) {
            assert.notEqual(Schemas.GuildCreateResponse.properties?.[field]?.format, "image-data-uri", `GuildCreateResponse.${field}`);
            assert.notEqual(Schemas.APIGuildWithJoinedAt.properties?.[field]?.format, "image-data-uri", `APIGuildWithJoinedAt.${field}`);
            assert.equal(Schemas.GuildUpdateSchema.properties?.[field]?.format, "image-data-uri-or-asset-hash", `GuildUpdateSchema.${field}`);
        }
    });
});

describe("RoleModifySchema", () => {
    test("accepts role names up to 255 characters", () => {
        const name = "a".repeat(255);

        assert.deepEqual(validateSchema("RoleModifySchema", { name }), { name });
    });

    test("rejects role names longer than 255 characters as a field length error", () => {
        const validate = ajv.getSchema("RoleModifySchema");
        assert.ok(validate);

        assert.equal(Schemas.RoleModifySchema.properties?.name?.maxLength, 255);
        assert.equal(validate({ name: "a".repeat(256) }), false);
        assert.deepEqual(ajvErrorsToFieldErrors(validate.errors ?? []), {
            name: {
                _errors: [
                    {
                        code: "BASE_TYPE_BAD_LENGTH",
                        message: "must NOT have more than 255 characters",
                    },
                ],
            },
        });
    });
});

describe("generated JSON schemas", () => {
    test("keeps gateway identify bitfields JSON-safe", () => {
        assert.deepEqual(schemaTypes(Schemas.IdentifySchema.properties?.intents), ["integer", "string"]);
        assert.deepEqual(schemaTypes(Schemas.IdentifySchema.properties?.shard?.items), ["integer", "string"]);
    });
});

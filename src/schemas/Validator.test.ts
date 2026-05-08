import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ajv, validateSchema } from "./Validator";
import { ajvErrorsToFieldErrors } from "../api/util/utility/AjvErrorFields";

const PngDataUri = "data:image/png;base64,iVBORw0KGgo=";
const AssetHash = "0123456789abcdef0123456789abcdef";
const Schemas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "schemas.json"), { encoding: "utf8" })) as Record<
    string,
    { properties?: Record<string, { format?: string; maxLength?: number }> }
>;

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
    ["UserModifySchema", "avatar"],
    ["UserModifySchema", "banner"],
    ["UserProfileModifySchema", "banner"],
    ["WebhookCreateSchema", "avatar"],
    ["WebhookUpdateSchema", "avatar"],
] as const;

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

describe("schema validator custom formats", () => {
    test("accepts image data URI fields with matching image bytes", () => {
        assert.deepEqual(validateSchema("WebhookCreateSchema", { name: "hook", avatar: PngDataUri }), { name: "hook", avatar: PngDataUri });
        assert.deepEqual(validateSchema("BotModifySchema", { banner: PngDataUri }), { banner: PngDataUri });
        assert.deepEqual(validateSchema("GuildTemplateCreateSchema", { name: "template", icon: PngDataUri }), { name: "template", icon: PngDataUri });
        assert.deepEqual(validateSchema("ChannelCreateSchema", { name: "voice", type: 2, icon: PngDataUri }), { name: "voice", type: 2, icon: PngDataUri });
        assert.deepEqual(validateSchema("RoleModifySchema", { icon: PngDataUri }), { icon: PngDataUri });
    });

    test("rejects image data URI fields with mismatched image bytes", () => {
        assert.throws(() => validateSchema("WebhookCreateSchema", { name: "hook", avatar: "data:image/png;base64,/9j/" }));
        assert.throws(() => validateSchema("BotModifySchema", { banner: AssetHash }));
        assert.throws(() => validateSchema("GuildTemplateCreateSchema", { name: "template", icon: AssetHash }));
    });

    test("allows guild update fields to preserve current asset hashes", () => {
        assert.deepEqual(validateSchema("GuildUpdateSchema", { icon: AssetHash, banner: `a_${AssetHash}`, splash: null }), {
            icon: AssetHash,
            banner: `a_${AssetHash}`,
            splash: null,
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

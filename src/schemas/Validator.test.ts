import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { validateSchema } from "./Validator";

const PngDataUri = "data:image/png;base64,iVBORw0KGgo=";
const AssetHash = "0123456789abcdef0123456789abcdef";
const Schemas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "schemas.json"), { encoding: "utf8" })) as Record<
    string,
    { properties?: Record<string, { format?: string }> }
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

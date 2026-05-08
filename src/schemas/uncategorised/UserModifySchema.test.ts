import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const validPngDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function validate(schemaName: string, payload: unknown) {
    const schema = ajv.getSchema(schemaName);
    assert.ok(schema, `${schemaName} should be registered`);
    return ajv.validate(schemaName, payload);
}

describe("UserModifySchema", () => {
    const validateUserModify = ajv.getSchema("UserModifySchema");

    test("allows null email so optional email can be cleared", () => {
        assert.ok(validateUserModify);
        assert.equal(validateUserModify!({ email: null, password: "hunter2" }), true);
    });

    test("still validates non-null email format", () => {
        assert.ok(validateUserModify);
        assert.equal(validateUserModify!({ email: "user@example.com", password: "hunter2" }), true);
        assert.equal(validateUserModify!({ email: "not an email", password: "hunter2" }), false);
    });

    test("accepts recent-avatar upload metadata from modern clients", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar: validPngDataUri,
                avatar_description: "avatar.png, added May 6, 2026 at 11:04 AM",
            }),
            true,
        );
    });

    test("accepts selecting a persisted recent avatar by id", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar_id: "1386423687284265200",
            }),
            true,
        );
    });

    test("accepts null avatar descriptions", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar_description: null,
            }),
            true,
        );
    });

    test("keeps rejecting unknown user modification fields", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar_description: "valid",
                unknown_avatar_field: true,
            }),
            false,
        );
        assert.equal(
            ajv.errors?.some((error) => error.keyword === "additionalProperties"),
            true,
        );
    });

    test("rejects object avatar descriptions", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar_description: { text: "invalid" },
            }),
            false,
        );
        assert.equal(
            ajv.errors?.some((error) => error.instancePath === "/avatar_description" && error.keyword === "type"),
            true,
        );
    });

    test("limits avatar descriptions to Discord's 1024 character maximum", () => {
        assert.equal(
            ajv.validate("UserModifySchema", {
                avatar_description: "a".repeat(1025),
            }),
            false,
        );
        assert.equal(
            ajv.errors?.some((error) => error.instancePath === "/avatar_description" && error.keyword === "maxLength"),
            true,
        );
    });

    test("keeps the composite schema compatible with account, avatar, and profile-style fields", () => {
        assert.equal(
            validate("UserModifySchema", {
                username: "spacebar",
                password: "hunter2",
                avatar: validPngDataUri,
                avatar_description: "avatar.png, added May 6, 2026 at 11:04 AM",
                bio: "hello",
                banner: validPngDataUri,
                display_name_colors: [0x5865f2, 0xffffff],
                display_name_effect_id: 1,
                display_name_font_id: 1,
            }),
            true,
        );
    });
});

describe("dedicated user modification schemas", () => {
    test("UserAccountModifySchema validates only account and credential fields", () => {
        assert.equal(validate("UserAccountModifySchema", { username: "spacebar", email: "user@example.com", password: "hunter2" }), true);
        assert.equal(validate("UserAccountModifySchema", { avatar_id: "1386423687284265200" }), false);
        assert.equal(
            ajv.errors?.some((error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "avatar_id"),
            true,
        );
    });

    test("UserAvatarModifySchema validates only avatar upload and recent-avatar fields", () => {
        assert.equal(validate("UserAvatarModifySchema", { avatar: validPngDataUri, avatar_description: null, avatar_id: "1386423687284265200" }), true);
        assert.equal(validate("UserAvatarModifySchema", { email: "user@example.com" }), false);
        assert.equal(
            ajv.errors?.some((error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "email"),
            true,
        );
    });

    test("UserProfileStyleModifySchema validates only profile and display-style fields owned by the self-user route", () => {
        assert.equal(
            validate("UserProfileStyleModifySchema", {
                bio: "hello",
                accent_color: 0x5865f2,
                banner: validPngDataUri,
                display_name_colors: [0x5865f2, 0xffffff],
                display_name_effect_id: 1,
                display_name_font_id: 1,
            }),
            true,
        );
        assert.equal(validate("UserProfileStyleModifySchema", { password: "hunter2" }), false);
        assert.equal(
            ajv.errors?.some((error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "password"),
            true,
        );
    });
});

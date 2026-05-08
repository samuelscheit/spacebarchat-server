import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const validPngDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("UserModifySchema", () => {
    const validate = ajv.getSchema("UserModifySchema");

    test("allows null email so optional email can be cleared", () => {
        assert.ok(validate);
        assert.equal(validate!({ email: null, password: "hunter2" }), true);
    });

    test("allows profile updates without discriminator", () => {
        assert.ok(validate);
        assert.equal(validate!({ bio: "Updated profile" }), true);
    });

    test("still validates non-null email format", () => {
        assert.ok(validate);
        assert.equal(validate!({ email: "user@example.com", password: "hunter2" }), true);
        assert.equal(validate!({ email: "not an email", password: "hunter2" }), false);
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
});

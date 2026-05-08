import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { nonCoercingAjv } from "../Validator";

const baseAuthorizeBody = {
    authorize: true,
    guild_id: "guild",
    permissions: "0",
};

describe("ApplicationAuthorizeSchema", () => {
    test("accepts TOTP and MFA backup-code lengths", () => {
        assert.equal(nonCoercingAjv.validate("ApplicationAuthorizeSchema", { ...baseAuthorizeBody, code: "123456" }), true);
        assert.equal(nonCoercingAjv.validate("ApplicationAuthorizeSchema", { ...baseAuthorizeBody, code: "deadbeef" }), true);
    });

    test("rejects MFA code values longer than generated backup codes", () => {
        assert.equal(nonCoercingAjv.validate("ApplicationAuthorizeSchema", { ...baseAuthorizeBody, code: "too-long9" }), false);
    });
});

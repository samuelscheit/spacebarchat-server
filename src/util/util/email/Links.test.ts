import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildEmailActionLink, getEmailActionTokenPurpose, MailTypes } from "./index";
import { EmailActionTokenPurpose } from "../EmailActionToken";

describe("email action links", () => {
    test("maps email types to purpose-scoped token purposes", () => {
        assert.equal(getEmailActionTokenPurpose(MailTypes.verifyEmail), EmailActionTokenPurpose.verifyEmail);
        assert.equal(getEmailActionTokenPurpose(MailTypes.resetPassword), EmailActionTokenPurpose.resetPassword);
    });

    test("builds reset and verification URLs without the API suffix", () => {
        assert.equal(buildEmailActionLink(MailTypes.resetPassword, "reset-token", "https://example.test/api"), "https://example.test/reset-password#token=reset-token");
        assert.equal(buildEmailActionLink(MailTypes.verifyEmail, "verify-token", "https://example.test/api"), "https://example.test/verify-email#token=verify-token");
    });
});

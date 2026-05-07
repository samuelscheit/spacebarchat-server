import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isAccessTokenPayload } from "./AuthTokenPayload";
import { EmailActionTokenPurpose, isEmailActionTokenPayload } from "./EmailActionToken";
import { createTokenPayload, CurrentTokenFormatVersion, FirstTokenFormatVersionWithDeviceId } from "./TokenPayload";

describe("AuthTokenPayload", () => {
    test("accepts bearer-auth payloads while rejecting explicit non-access token types", () => {
        assert.equal(isAccessTokenPayload(createTokenPayload("user", 1700000000, "key", "session")), true);

        assert.equal(
            isAccessTokenPayload({
                typ: "access",
                sub: "user",
                did: "session",
                iat: 1700000000,
                ver: CurrentTokenFormatVersion,
            }),
            true,
        );

        assert.equal(
            isAccessTokenPayload({
                id: "user",
                iat: 1700000000,
                ver: FirstTokenFormatVersionWithDeviceId - 1,
            }),
            true,
        );

        assert.equal(
            isAccessTokenPayload({
                typ: "access",
                id: "user",
                did: "session",
                iat: 1700000000,
                ver: CurrentTokenFormatVersion,
            }),
            false,
        );

        assert.equal(
            isAccessTokenPayload({
                typ: "email_action",
                id: "user",
                did: "session",
                iat: 1700000000,
                ver: 1,
            }),
            false,
        );
    });

    test("email action tokens are distinguishable from bearer auth tokens", () => {
        const payload = {
            typ: "email_action",
            id: "user",
            iat: 1700000000,
            exp: 1700003600,
            kid: "key",
            purpose: EmailActionTokenPurpose.resetPassword,
            nonce: "nonce",
            ver: 1,
        };

        assert.equal(isEmailActionTokenPayload(payload), true);
        assert.equal(isAccessTokenPayload(payload), false);
    });
});

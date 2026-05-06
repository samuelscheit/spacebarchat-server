import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isAccessTokenPayload } from "./AuthTokenPayload";
import { EmailActionTokenPurpose, isEmailActionTokenPayload } from "./EmailActionToken";

describe("AuthTokenPayload", () => {
    test("accepts only explicit access tokens as bearer-auth payloads", () => {
        assert.equal(
            isAccessTokenPayload({
                typ: "access",
                id: "user",
                did: "session",
                iat: 1700000000,
                ver: 4,
            }),
            true,
        );

        assert.equal(
            isAccessTokenPayload({
                id: "user",
                did: "session",
                iat: 1700000000,
                ver: 3,
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

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    createMfaRequiredResponse,
    createRecentMfaCookie,
    getRecentMfaToken,
    RECENT_MFA_COOKIE,
    RECENT_MFA_HEADER,
    signRecentMfaToken,
    signMfaTicket,
    verifyMfaTicket,
    verifyRecentMfaToken,
} from "./Mfa";

describe("modern MFA utilities", () => {
    test("builds the modern MFA required response", () => {
        assert.deepEqual(createMfaRequiredResponse("ticket-1"), {
            message: "Two factor is required for this operation",
            code: 60003,
            mfa: {
                ticket: "ticket-1",
                methods: [{ type: "password" }],
            },
        });
    });

    test("prefers MFA authorization header over cookie", () => {
        assert.equal(
            getRecentMfaToken({
                [RECENT_MFA_HEADER]: "header-token",
                cookie: `${RECENT_MFA_COOKIE}=cookie-token`,
            }),
            "header-token",
        );
    });

    test("extracts recent MFA token from cookies", () => {
        assert.equal(getRecentMfaToken({ cookie: `foo=bar; ${RECENT_MFA_COOKIE}=cookie-token; baz=qux` }), "cookie-token");
    });

    test("creates a five minute secure recent MFA cookie", () => {
        assert.equal(createRecentMfaCookie("token"), `${RECENT_MFA_COOKIE}=token; Max-Age=300; Path=/; Secure; HttpOnly; SameSite=None`);
    });

    test("verifies signed recent MFA tokens for the matching user", () => {
        const now = 1_700_000_000_000;
        const token = signRecentMfaToken("user-1", "secret", now);

        assert.equal(verifyRecentMfaToken(token, "user-1", "secret", now + 299_000), true);
        assert.equal(verifyRecentMfaToken(token, "user-2", "secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, "user-1", "wrong-secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, "user-1", "secret", now + 301_000), false);
    });

    test("verifies signed MFA tickets without creating user session tokens", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket("user-1", "secret", now);

        assert.equal(verifyMfaTicket(ticket, "secret", now + 299_000)?.user_id, "user-1");
        assert.equal(verifyMfaTicket(ticket, "wrong-secret", now + 299_000), undefined);
        assert.equal(verifyMfaTicket(ticket, "secret", now + 301_000), undefined);
        assert.equal(verifyRecentMfaToken(ticket, "user-1", "secret", now + 299_000), false);
    });
});

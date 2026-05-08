import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    createMfaRequiredResponse,
    createRecentMfaCookie,
    getRecentMfaToken,
    MFA_ACTION_LOGIN,
    MFA_ACTION_TOTP_ENABLE,
    RECENT_MFA_COOKIE,
    RECENT_MFA_HEADER,
    signRecentMfaToken,
    signMfaTicket,
    type MfaTokenContext,
    verifyLoginMfaTicket,
    verifyMfaTicket,
    verifyRecentMfaToken,
} from "./Mfa";

describe("modern MFA utilities", () => {
    const context: MfaTokenContext = {
        userId: "user-1",
        action: MFA_ACTION_TOTP_ENABLE,
        sessionId: "session-1",
    };

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
        const token = signRecentMfaToken(context, "secret", now);

        assert.equal(verifyRecentMfaToken(token, context, "secret", now + 299_000), true);
        assert.equal(verifyRecentMfaToken(token, { ...context, userId: "user-2" }, "secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, { ...context, sessionId: "session-2" }, "secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, { ...context, sessionId: undefined }, "secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, context, "wrong-secret", now + 299_000), false);
        assert.equal(verifyRecentMfaToken(token, context, "secret", now + 301_000), false);
    });

    test("verifies signed MFA tickets without creating user session tokens", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket(context, "secret", now);

        assert.equal(verifyMfaTicket(ticket, "secret", now + 299_000)?.user_id, "user-1");
        assert.equal(verifyMfaTicket(ticket, "secret", now + 299_000)?.session_id, "session-1");
        assert.equal(verifyMfaTicket(ticket, "wrong-secret", now + 299_000), undefined);
        assert.equal(verifyMfaTicket(ticket, "secret", now + 301_000), undefined);
        assert.equal(verifyRecentMfaToken(ticket, context, "secret", now + 299_000), false);
    });

    test("rejects MFA tickets rewritten with a recent MFA token prefix", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket(context, "secret", now);
        const rewrittenTicket = ticket.replace(/^mfa_ticket\./, "mfa.");

        assert.equal(verifyRecentMfaToken(rewrittenTicket, context, "secret", now + 299_000), false);
    });

    test("rejects MFA tickets that are not bound to a session", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket({ ...context, sessionId: undefined }, "secret", now);

        assert.equal(verifyMfaTicket(ticket, "secret", now + 299_000), undefined);
    });

    test("verifies signed login MFA tickets for the matching user", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket({ userId: "user-1", action: MFA_ACTION_LOGIN, sessionId: undefined }, "secret", now);

        const payload = verifyLoginMfaTicket(ticket, "user-1", "secret", now + 299_000);

        assert.equal(payload?.user_id, "user-1");
        assert.equal(payload?.action, MFA_ACTION_LOGIN);
        assert.equal(payload?.session_id, undefined);
    });

    test("rejects invalid login MFA tickets", () => {
        const now = 1_700_000_000_000;
        const ticket = signMfaTicket({ userId: "user-1", action: MFA_ACTION_LOGIN, sessionId: undefined }, "secret", now);

        assert.equal(verifyLoginMfaTicket(ticket, "user-2", "secret", now + 299_000), undefined);
        assert.equal(verifyLoginMfaTicket(ticket, "user-1", "wrong-secret", now + 299_000), undefined);
        assert.equal(verifyLoginMfaTicket(ticket, "user-1", "secret", now + 301_000), undefined);
        assert.equal(verifyLoginMfaTicket("not-a-ticket", "user-1", "secret", now + 299_000), undefined);
        assert.equal(verifyLoginMfaTicket(undefined, "user-1", "secret", now + 299_000), undefined);
    });

    test("keeps login MFA tickets separate from session-bound MFA tickets and recent MFA tokens", () => {
        const now = 1_700_000_000_000;
        const loginTicket = signMfaTicket({ userId: "user-1", action: MFA_ACTION_LOGIN, sessionId: undefined }, "secret", now);
        const sessionTicket = signMfaTicket(context, "secret", now);
        const recentToken = signRecentMfaToken({ ...context, action: MFA_ACTION_LOGIN }, "secret", now);

        assert.equal(verifyMfaTicket(loginTicket, "secret", now + 299_000), undefined);
        assert.equal(verifyLoginMfaTicket(sessionTicket, "user-1", "secret", now + 299_000), undefined);
        assert.equal(verifyLoginMfaTicket(recentToken, "user-1", "secret", now + 299_000), undefined);
    });
});

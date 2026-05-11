import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Authentication } from "./Authentication";
import { isNoAuthorizationRoute } from "./NoAuthorizationRoutes";

async function runAuthentication(method: string, url: string, authorization?: string) {
    let nextCalled = false;
    let nextError: unknown;
    const headers: Record<string, string> = { cookie: "__sb_sessid=test-fingerprint" };
    if (authorization) headers.authorization = authorization;

    await Authentication(
        {
            method,
            url,
            headers,
            ip: "127.0.0.1",
        } as never,
        {
            setHeader: () => undefined,
        } as never,
        (error?: unknown) => {
            nextCalled = true;
            nextError = error;
        },
    );

    assert.equal(nextCalled, true);
    return nextError;
}

describe("unauthenticated route matching", () => {
    test("ignores API version prefixes and query strings", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/experiments?with_guild_experiments=true"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments?surface=2"), true);
    });

    test("accepts optional trailing slashes on exact public routes", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/experiments/?with_guild_experiments=true"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments/?surface=2"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/experiments/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments/"), true);
    });

    test("keeps protected routes protected when only their query string resembles a public route", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me?next=/experiments"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/?next=/experiments"), false);
    });

    test("does not treat exact public routes as public prefixes", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/experiments/not-a-route"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments/not-a-route"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments/metadata?surface=2"), false);
    });

    test("allows only the implemented unauthenticated reporting experiment GET route without bearer auth", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/reporting/unauthenticated/experiment"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/reporting/unauthenticated/experiment"), true);

        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/reporting/unauthenticated/menu/message"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/experiment"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/message"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/message/code"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/message/verify"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/reporting/unauthenticated/experiment/extra"), false);
    });

    test("allows MFA finish with and without the generated trailing slash", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/mfa/finish/"), true);
    });

    test("allows generated trailing slashes for exact no-auth routes", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/auth/login/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/auth/password/validate/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/ping/"), true);
    });

    test("allows public native module version routes without authorization", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/versions.json?platform=osx&host_version=0"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/modules/canary/versions.json/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/versions.json/extra/more"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/modules/stable/versions.json"), false);
    });

    test("allows public native module archive routes without authorization", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/discord_desktop_core/1?platform=osx&host_version=0"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/modules/canary/discord_voice/2/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/versions.json/extra"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/discord_voice/not-a-version"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/modules/stable/discord_voice/1/extra"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/modules/stable/discord_voice/1"), false);
    });

    test("allows published discovery search without authorization", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discovery/search?query=spacebar&limit=1"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/discovery/search/?query=spacebar"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/discovery/search"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/discovery/search/extra"), false);
    });

    test("allows unauthenticated unique username registration suggestions", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/unique-username/username-suggestions-unauthed"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/unique-username/username-suggestions-unauthed?global_name=Gnarp"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/unique-username/username-suggestions-unauthed/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/unique-username/username-suggestions-unauthed"), false);
    });

    test("allows unauthenticated unique username registration attempts", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/unique-username/username-attempt-unauthed"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/unique-username/username-attempt-unauthed"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/unique-username/username-attempt-unauthed/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/unique-username/username-attempt-unauthed"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/unique-username/username-attempt-unauthed"), false);
    });

    test("allows client analytics sink routes without authorization", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/beaker?client=desktop"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/science"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/science/?events=1"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/track"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/track?source=client"), true);
    });

    test("does not treat client analytics sink routes as public prefixes", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker/not-a-route"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/beaker"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/science"), false);
    });

    test("does not let HEAD inherit POST-only public sink authorization", () => {
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/ping"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/beaker"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/auth/login"), false);
    });

    test("does not allow unrelated MFA finish subpaths without bearer auth", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish/extra"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/mfa/finish/"), false);
    });

    test("allows token-auth webhook routes with base64url tokens", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/-abc_DEF"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/abc-DEF_123"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/abc-DEF_123?wait=true"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc-DEF_123/github/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc-DEF_123/slack"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/webhooks/123/abc-DEF_123/slack/?wait=false"), true);
    });

    test("allows token-auth webhook message routes with query strings", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
        assert.equal(isNoAuthorizationRoute("DELETE", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
    });

    test("does not partially match webhook token routes", () => {
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/abc-DEF_123/extra"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc-DEF_123/slack/extra"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/abc.DEF/messages/456"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc.DEF?wait=true"), false);
    });

    test("allows generated OpenAPI webhook token route templates", () => {
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/{webhook_id}/{token}/"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/{webhook_id}/{token}/messages/{message_id}/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/{webhook_id}/{token}/slack/"), true);
    });

    test("allows gift code resolution without bearer authorization", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/entitlements/gift-codes/2CG6SV9QtRxerJTgCYNDnU7M?with_application=true"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/entitlements/gift-codes/2CG6SV9QtRxerJTgCYNDnU7M"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/entitlements/gift-codes/2CG6SV9QtRxerJTgCYNDnU7M"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/entitlements/gift-codes/2CG6SV9QtRxerJTgCYNDnU7M/redeem"), false);
    });
});

describe("Authentication middleware", () => {
    test("allows unauthenticated beaker telemetry requests through the auth boundary", async () => {
        assert.equal(await runAuthentication("POST", "/api/v9/beaker"), undefined);
    });

    test("ignores malformed bearer auth on public beaker telemetry requests", async () => {
        const originalError = console.error;
        console.error = () => undefined;
        try {
            assert.equal(await runAuthentication("POST", "/api/v9/beaker", "not-a-jwt"), undefined);
        } finally {
            console.error = originalError;
        }
    });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isNoAuthorizationRoute } from "./NoAuthorizationRoutes";

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

    test("allows MFA finish with and without the generated trailing slash", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/mfa/finish/"), true);
    });

    test("allows generated trailing slashes for exact no-auth routes", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/auth/login/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/ping/"), true);
    });

    test("allows client analytics sink routes without authorization", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/beaker?client=desktop"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/science"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/track"), true);
    });

    test("does not treat client analytics sink routes as public prefixes", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/beaker/not-a-route"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/beaker"), false);
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
    });

    test("allows token-auth webhook message routes with query strings", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
        assert.equal(isNoAuthorizationRoute("DELETE", "/webhooks/123/-abc_DEF/messages/456?thread_id=789"), true);
    });

    test("does not partially match webhook token routes", () => {
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/abc-DEF_123/extra"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/abc.DEF/messages/456"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc.DEF?wait=true"), false);
    });

    test("allows generated OpenAPI webhook token route templates", () => {
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/{webhook_id}/{token}/"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/{webhook_id}/{token}/messages/{message_id}/"), true);
    });
});

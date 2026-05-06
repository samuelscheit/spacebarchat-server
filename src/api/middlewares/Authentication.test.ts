import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isNoAuthorizationRoute } from "./Authentication";

describe("authentication route exemptions", () => {
    test("allows token-auth webhook routes with base64url tokens", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/-abc_DEF"), true);
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/abc-DEF_123"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/webhooks/123/abc-DEF_123?wait=true"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/webhooks/123/abc-DEF_123/github/"), true);
    });

    test("does not partially match webhook token routes", () => {
        assert.equal(isNoAuthorizationRoute("PATCH", "/webhooks/123/abc-DEF_123/extra"), false);
    });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isNoAuthorizationRoute } from "./NoAuthorizationRoutes";

describe("authentication route exemptions", () => {
    test("allows MFA finish with and without the generated trailing slash", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/mfa/finish/"), true);
    });

    test("allows generated trailing slashes for exact no-auth routes", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/auth/login/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/ping/"), true);
    });

    test("does not allow unrelated MFA finish subpaths without bearer auth", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/mfa/finish/extra"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/mfa/finish/"), false);
    });
});

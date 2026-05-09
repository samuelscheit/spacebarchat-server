"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scanRouterCalls, stripComments } = require("./lib");

const routePath = path.join(process.cwd(), "src", "api", "routes", "auth", "verify", "resend.ts");

test("auth verify resend documents route-specific API error preconditions", () => {
    const source = readFileSync(routePath, "utf8");
    const executableSource = stripComments(source);
    const resendRoute = scanRouterCalls(source).find((call) => call.method === "POST" && call.localPath === "/");

    assert.ok(resendRoute, "expected POST / route metadata in auth verify resend route");
    assert.equal(resendRoute.routeMetadata.right, "RESEND_VERIFICATION_EMAIL");
    assert.deepEqual(resendRoute.routeMetadata.responseStatuses, [204, 400, 500]);
    assert.deepEqual(resendRoute.routeMetadata.responseBodies, ["APIErrorResponse"]);
    assert.match(executableSource, /400:\s*\{\s*body:\s*"APIErrorResponse"\s*,?\s*\}/);
    assert.match(executableSource, /500:\s*\{\s*body:\s*"APIErrorResponse"\s*,?\s*\}/);
    assert.doesNotMatch(executableSource, /APIErrorOrCaptchaResponse/);

    assert.match(executableSource, /throw\s+new\s+HTTPError\(\s*"User does not have an email address"\s*,\s*400\s*\)/);
    assert.match(executableSource, /throw\s+new\s+HTTPError\(\s*"Email is already verified"\s*,\s*400\s*\)/);
    assert.doesNotMatch(source, /whats the proper error response/i);
});

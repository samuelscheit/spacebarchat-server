import assert from "node:assert/strict";
import { test } from "node:test";
import { CurrentTokenFormatVersion } from "@spacebar/util";
import { expiredLikeTokenPayload, invalidToken, makeAuthContext, makeAuthorization, makeTokenPayload } from "./auth";
import { makeSession, makeUser } from "./entities";

test("auth fixtures create token payloads and authorization headers without persistence", () => {
    const user = makeUser();
    const session = makeSession(user);
    const payload = makeTokenPayload(user, session);
    const expiredPayload = expiredLikeTokenPayload(user, session);
    const context = makeAuthContext({ user, session, tokenPayload: payload });

    assert.equal(payload.sub, user.id);
    assert.equal(payload.did, session.session_id);
    assert.equal(payload.ver, CurrentTokenFormatVersion);
    assert.equal(expiredPayload.iat, 0);
    assert.equal(makeAuthorization("token"), "Bearer token");
    assert.equal(context.authorization, makeAuthorization(invalidToken()));
});

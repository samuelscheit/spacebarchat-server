import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { HTTPError } from "lambert-server";
import { checkToken, Config, CurrentTokenFormatVersion, InstanceBan, Session, User } from "@spacebar/util";

const TEST_JWT_SECRET = "test-secret";
const originalConsoleError = console.error;
const originalConfigGet = Config.get;
const originalUserFindOne = User.findOne;
const originalSessionFindOne = Session.findOne;
const originalFindInstanceBans = InstanceBan.findInstanceBans;

function signToken(payload: { id: string; iat: number; ver?: number; did?: string }) {
    return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: "HS256" });
}

function stubActiveUser() {
    User.findOne = (() =>
        Promise.resolve({
            id: "user_id",
            bot: false,
            disabled: false,
            deleted: false,
            rights: "0",
            data: { valid_tokens_since: new Date(0) },
        })) as typeof User.findOne;
    InstanceBan.findInstanceBans = (() => Promise.resolve([])) as typeof InstanceBan.findInstanceBans;
}

describe("checkToken session revocation", () => {
    beforeEach(() => {
        console.error = (() => undefined) as typeof console.error;
        Config.get = (() => ({ security: { jwtSecret: TEST_JWT_SECRET } })) as typeof Config.get;
    });

    afterEach(() => {
        console.error = originalConsoleError;
        Config.get = originalConfigGet;
        User.findOne = originalUserFindOne;
        Session.findOne = originalSessionFindOne;
        InstanceBan.findInstanceBans = originalFindInstanceBans;
    });

    test("rejects a current token when its session row was removed", async () => {
        stubActiveUser();
        let banLookupCount = 0;
        InstanceBan.findInstanceBans = (() => {
            banLookupCount++;
            return Promise.resolve([]);
        }) as typeof InstanceBan.findInstanceBans;

        Session.findOne = ((options: unknown) => {
            assert.deepEqual(options, { where: { session_id: "SESSION1", user_id: "user_id" } });
            return Promise.resolve(null);
        }) as typeof Session.findOne;

        const token = signToken({
            id: "user_id",
            iat: Math.floor(Date.now() / 1000),
            ver: CurrentTokenFormatVersion,
            did: "SESSION1",
        });

        await assert.rejects(
            () => checkToken(`Bearer ${token}`),
            (error) => {
                assert.ok(error instanceof HTTPError);
                assert.equal(error.code, 401);
                assert.equal(error.message, "Invalid Token");
                return true;
            },
        );
        assert.equal(banLookupCount, 0);
    });

    test("rejects a current token without a session id", async () => {
        stubActiveUser();
        let sessionLookupCount = 0;
        Session.findOne = (() => {
            sessionLookupCount++;
            return Promise.resolve(null);
        }) as typeof Session.findOne;

        const token = signToken({
            id: "user_id",
            iat: Math.floor(Date.now() / 1000),
            ver: CurrentTokenFormatVersion,
        });

        await assert.rejects(() => checkToken(token), HTTPError);
        assert.equal(sessionLookupCount, 0);
    });

    test("accepts a current token while its session row exists", async () => {
        stubActiveUser();
        Session.findOne = (() =>
            Promise.resolve({
                session_id: "SESSION1",
                user_id: "user_id",
                last_seen: new Date(),
            })) as typeof Session.findOne;

        const token = signToken({
            id: "user_id",
            iat: Math.floor(Date.now() / 1000),
            ver: CurrentTokenFormatVersion,
            did: "SESSION1",
        });

        const result = await checkToken(token);
        assert.equal(result.user.id, "user_id");
        assert.equal(result.session?.session_id, "SESSION1");
        assert.equal(result.tokenVersion, CurrentTokenFormatVersion);
    });

    test("keeps explicit legacy tokens without a session id accepted", async () => {
        stubActiveUser();
        let sessionLookupCount = 0;
        Session.findOne = (() => {
            sessionLookupCount++;
            return Promise.resolve(null);
        }) as typeof Session.findOne;

        const token = signToken({
            id: "user_id",
            iat: Math.floor(Date.now() / 1000),
            ver: 2,
        });

        const result = await checkToken(token);
        assert.equal(result.user.id, "user_id");
        assert.equal(result.session, undefined);
        assert.equal(result.tokenVersion, 2);
        assert.equal(sessionLookupCount, 0);
    });
});

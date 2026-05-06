import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import jwt from "jsonwebtoken";
import { HTTPError } from "lambert-server";

const TEST_JWT_SECRET = "test-secret";

type ModuleLoad = (this: unknown, request: string, parent: { filename?: string } | null, isMain: boolean) => unknown;
type TestUser = {
    id: string;
    bot: boolean;
    disabled: boolean;
    deleted: boolean;
    rights: string;
    data: { valid_tokens_since: Date };
};
type TestSession = {
    session_id: string;
    user_id: string;
    last_seen?: Date;
    last_seen_ip?: string;
    updateIpInfo?: () => Promise<void>;
    save?: () => Promise<void>;
};

const Config = {
    get: () => ({ security: { jwtSecret: TEST_JWT_SECRET } }),
};
const User: { findOne: (options: unknown) => Promise<TestUser | null> } = {
    findOne: () => Promise.resolve(null),
};
const Session: { findOne: (options: unknown) => Promise<TestSession | null> } = {
    findOne: () => Promise.resolve(null),
};
const InstanceBan: { findInstanceBans: (options: unknown) => Promise<string[]> } = {
    findInstanceBans: () => Promise.resolve([]),
};

const moduleLoader = Module as typeof Module & { _load: ModuleLoad };
const originalModuleLoad = moduleLoader._load;
moduleLoader._load = function (this: unknown, request: string, parent: { filename?: string } | null, isMain: boolean): unknown {
    const isTokenImport =
        parent?.filename?.endsWith("/Token.js") || parent?.filename?.endsWith("\\Token.js") || parent?.filename?.endsWith("/Token.ts") || parent?.filename?.endsWith("\\Token.ts");
    if (isTokenImport) {
        if (request === "./Config") return { Config };
        if (request === "../entities/InstanceBan") return { InstanceBan };
        if (request === "../entities/Session") return { Session };
        if (request === "../entities/User") return { User };
    }

    return originalModuleLoad.apply(this, [request, parent, isMain]);
};
const { checkToken, CurrentTokenFormatVersion, FirstTokenFormatVersionWithDeviceId } = require("./Token") as typeof import("./Token");
moduleLoader._load = originalModuleLoad;

const originalConsoleError = console.error;

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
        Config.get = () => ({ security: { jwtSecret: TEST_JWT_SECRET } });
        User.findOne = () => Promise.resolve(null);
        Session.findOne = () => Promise.resolve(null);
        InstanceBan.findInstanceBans = () => Promise.resolve([]);
    });

    test("rejects a session-bound token when its session row was removed", async () => {
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
            ver: FirstTokenFormatVersionWithDeviceId,
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

    test("rejects the first session-bound token format without a session id", async () => {
        stubActiveUser();
        let sessionLookupCount = 0;
        Session.findOne = (() => {
            sessionLookupCount++;
            return Promise.resolve(null);
        }) as typeof Session.findOne;

        const token = signToken({
            id: "user_id",
            iat: Math.floor(Date.now() / 1000),
            ver: FirstTokenFormatVersionWithDeviceId,
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

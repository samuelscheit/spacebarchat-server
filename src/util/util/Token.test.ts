import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
import jwt from "jsonwebtoken";
import {
    checkToken,
    createTokenPayload,
    CurrentTokenFormatVersion,
    generateTokenForSession,
    getInvalidCurrentTokenSessionReason,
    loadOrGenerateKeypair,
    setTokenEntityStoresForTests,
    type TokenEntityStores,
    type UserTokenData,
} from "./Token";

function testUser() {
    return {
        id: "USER",
        bot: false,
        disabled: false,
        deleted: false,
        rights: "0",
        data: {
            valid_tokens_since: new Date(0),
        },
    };
}

function setTokenStoreMocks(
    t: TestContext,
    opts: {
        session?: { session_id: string; last_seen?: Date };
    } = {},
) {
    setTokenEntityStoresForTests({
        User: {
            findOne: t.mock.fn(async () => testUser()),
        },
        Session: {
            findOne: t.mock.fn(async () => opts.session),
        },
        InstanceBan: {
            findInstanceBans: t.mock.fn(async () => []),
        },
    } as unknown as TokenEntityStores);

    t.after(() => setTokenEntityStoresForTests(undefined));
}

async function signPayload(payload: UserTokenData["decoded"]) {
    const keyPair = await loadOrGenerateKeypair();

    return new Promise<string>((resolve, reject) => {
        jwt.sign(payload, keyPair.privateKey, { algorithm: "ES512" }, (err, token) => {
            if (err) return reject(err);
            return resolve(token!);
        });
    });
}

async function withTempCwd<T>(callback: () => Promise<T>) {
    const oldCwd = process.cwd();
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-token-test-"));

    try {
        process.chdir(testDir);
        return await callback();
    } finally {
        process.chdir(oldCwd);
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

describe("token session binding", () => {
    test("validates current-format token session references", () => {
        assert.equal(getInvalidCurrentTokenSessionReason({ did: "SESSION" }, CurrentTokenFormatVersion, { session_id: "SESSION" }), undefined);
        assert.equal(getInvalidCurrentTokenSessionReason({}, CurrentTokenFormatVersion, undefined), "Current token has no real session id");
        assert.equal(getInvalidCurrentTokenSessionReason({ did: "all" }, CurrentTokenFormatVersion, { session_id: "all" }), "Current token has no real session id");
        assert.equal(getInvalidCurrentTokenSessionReason({ did: "TEMP_socket" }, CurrentTokenFormatVersion, { session_id: "TEMP_socket" }), "Current token has no real session id");
        assert.equal(getInvalidCurrentTokenSessionReason({ did: "MISSING" }, CurrentTokenFormatVersion, undefined), "Current token session was not found");
        assert.equal(getInvalidCurrentTokenSessionReason({ did: "LEGACY_MISSING" }, CurrentTokenFormatVersion - 1, undefined), undefined);
    });

    test("creates current-format token payloads for the selected session", () => {
        assert.deepEqual(createTokenPayload("USER", 123, "fingerprint", "SESSION"), {
            sub: "USER",
            iat: 123,
            kid: "fingerprint",
            ver: CurrentTokenFormatVersion,
            did: "SESSION",
        });
    });

    test("signs refreshed tokens for an existing session instead of a new one", async () =>
        withTempCwd(async () => {
            const token = (await generateTokenForSession("USER", "EXISTING_SESSION"))!;
            const decoded = jwt.decode(token) as { sub?: string; ver?: number; did?: string };

            assert.equal(decoded.sub, "USER");
            assert.equal(decoded.ver, CurrentTokenFormatVersion);
            assert.equal(decoded.did, "EXISTING_SESSION");
        }));

    test("refuses to sign current-format tokens for invalid session ids", async () =>
        assert.rejects(() => withTempCwd(() => generateTokenForSession("USER", "TEMP_socket")), /invalid session id/));

    test("checkToken rejects current-format tokens with unresolved session ids", async (t) =>
        withTempCwd(async () => {
            setTokenStoreMocks(t);

            const token = await signPayload(createTokenPayload("USER", 123, "fingerprint", "MISSING_SESSION"));
            await assert.rejects(() => checkToken(token), /Invalid Token/);
        }));

    test("checkToken rejects current-format tokens without real session ids", async (t) =>
        withTempCwd(async () => {
            setTokenStoreMocks(t);

            for (const did of [undefined, "TEMP_socket"]) {
                const token = await signPayload({ ...createTokenPayload("USER", 123, "fingerprint", "IGNORED"), did });
                await assert.rejects(() => checkToken(token), /Invalid Token/);
            }
        }));

    test("checkToken rejects current-format tokens with invalid session ids", async (t) =>
        withTempCwd(async () => {
            setTokenStoreMocks(t, { session: { session_id: "all" } });

            const token = await signPayload({ ...createTokenPayload("USER", 123, "fingerprint", "all"), did: "all" });
            await assert.rejects(() => checkToken(token), /Invalid Token/);
        }));

    test("checkToken accepts current-format tokens with existing real session ids", async (t) =>
        withTempCwd(async () => {
            setTokenStoreMocks(t, { session: { session_id: "SESSION", last_seen: new Date() } });

            const token = await signPayload(createTokenPayload("USER", 123, "fingerprint", "SESSION"));
            const tokenData = await checkToken(token);

            assert.equal(tokenData.tokenVersion, CurrentTokenFormatVersion);
            assert.equal(tokenData.session?.session_id, "SESSION");
        }));
});

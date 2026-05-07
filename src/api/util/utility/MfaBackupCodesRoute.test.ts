import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcrypt";
import express from "express";
import { getMfaBackupCodesChallengePurpose, issueMfaBackupCodesChallengeNonce, verifyMfaBackupCodesChallengeNonce } from "@spacebar/api";
import { AuthActionToken, BackupCode, User } from "@spacebar/util";
import viewBackupCodesChallengeRouter from "../../routes/auth/verify/view-backup-codes-challenge";
import codesVerificationRouter from "../../routes/users/@me/mfa/codes-verification";

interface UserStaticsPatch {
    findOneOrFail(options: unknown): Promise<unknown>;
}

interface BackupCodeStaticsPatch {
    create(options: unknown): BackupCode;
    find(options: unknown): Promise<unknown[]>;
    update(criteria: unknown, partialEntity: unknown): Promise<unknown>;
}

interface AuthActionTokenRecord {
    token_hash: string;
    user_id: string;
    purpose: string;
    expires_at: Date;
    consumed_at: Date | null;
}

interface AuthActionTokenStaticsPatch {
    insert(record: AuthActionTokenRecord): Promise<unknown>;
    update(criteria: unknown, partialEntity: unknown): Promise<{ affected?: number | null }>;
}

function createApp(user_id = "user-a") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = user_id;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/", codesVerificationRouter);
    app.use((error: { code?: number | string; message?: string; errors?: unknown }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = error.code === 50035 ? 400 : 500;
        res.status(status).json({ code: error.code, message: error.message, errors: error.errors });
    });

    return app;
}

function createChallengeApp(user_id = "user-a") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = user_id;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/", viewBackupCodesChallengeRouter);
    app.use((error: { code?: number | string; message?: string; errors?: unknown }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = error.code === 50035 ? 400 : 500;
        res.status(status).json({ code: error.code, message: error.message, errors: error.errors });
    });

    return app;
}

async function postJson(app: express.Express, body: object) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const json = (await response.json()) as unknown;

        return { response, json };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("POST /users/@me/mfa/codes-verification", () => {
    const userStatics = User as unknown as UserStaticsPatch;
    const backupCodeStatics = BackupCode as unknown as BackupCodeStaticsPatch;
    const authActionTokenStatics = AuthActionToken as unknown as AuthActionTokenStaticsPatch;
    const originalUserFindOneOrFail = userStatics.findOneOrFail;
    const originalBackupCodeCreate = backupCodeStatics.create;
    const originalBackupCodeFind = backupCodeStatics.find;
    const originalBackupCodeUpdate = backupCodeStatics.update;
    const originalBackupCodeSave = BackupCode.prototype.save;
    const originalAuthActionTokenInsert = authActionTokenStatics.insert;
    const originalAuthActionTokenUpdate = authActionTokenStatics.update;

    let userFindCalls: unknown[];
    let backupFindCalls: unknown[];
    let backupUpdateCalls: unknown[];
    let authActionTokenInsertCalls: AuthActionTokenRecord[];
    let authActionTokenUpdateCalls: Array<{ criteria: unknown; partialEntity: unknown }>;
    let consumedChallengeTokenHashes: Set<string>;
    let savedBackupCodes: BackupCode[];
    let passwordHash: string;

    beforeEach(async () => {
        userFindCalls = [];
        backupFindCalls = [];
        backupUpdateCalls = [];
        authActionTokenInsertCalls = [];
        authActionTokenUpdateCalls = [];
        consumedChallengeTokenHashes = new Set();
        savedBackupCodes = [];
        passwordHash = await bcrypt.hash("correct-password", 4);

        userStatics.findOneOrFail = async (options: unknown) => {
            userFindCalls.push(options);
            return { data: { hash: passwordHash } };
        };
        backupCodeStatics.create = (options: unknown) => Object.assign(new BackupCode(), options);
        backupCodeStatics.find = async (options: unknown) => {
            backupFindCalls.push(options);
            return [
                {
                    id: "backup-a",
                    code: "abcdef12",
                    expired: false,
                    consumed: false,
                    user: { id: "user-a" },
                },
            ];
        };
        backupCodeStatics.update = async (criteria: unknown, partialEntity: unknown) => {
            backupUpdateCalls.push({ criteria, partialEntity });
            return { affected: 1 };
        };
        authActionTokenStatics.insert = async (record: AuthActionTokenRecord) => {
            authActionTokenInsertCalls.push(record);
            return { identifiers: [{ token_hash: record.token_hash }] };
        };
        authActionTokenStatics.update = async (criteria: unknown, partialEntity: unknown) => {
            authActionTokenUpdateCalls.push({ criteria, partialEntity });

            const { token_hash, user_id, purpose } = criteria as Partial<AuthActionTokenRecord>;
            const hasUnconsumedRecord = authActionTokenInsertCalls.some(
                (record) => record.token_hash === token_hash && record.user_id === user_id && record.purpose === purpose && !consumedChallengeTokenHashes.has(record.token_hash),
            );
            if (!token_hash || !hasUnconsumedRecord) return { affected: 0 };

            consumedChallengeTokenHashes.add(token_hash);
            return { affected: 1 };
        };
        BackupCode.prototype.save = async function () {
            savedBackupCodes.push(this);
            return this;
        };
    });

    afterEach(() => {
        userStatics.findOneOrFail = originalUserFindOneOrFail;
        backupCodeStatics.create = originalBackupCodeCreate;
        backupCodeStatics.find = originalBackupCodeFind;
        backupCodeStatics.update = originalBackupCodeUpdate;
        BackupCode.prototype.save = originalBackupCodeSave;
        authActionTokenStatics.insert = originalAuthActionTokenInsert;
        authActionTokenStatics.update = originalAuthActionTokenUpdate;
    });

    test("issues stored, action-bound challenge nonces after password verification", async () => {
        const { response, json } = await postJson(createChallengeApp(), {
            password: "correct-password",
        });

        assert.equal(response.status, 200);
        assert.equal(userFindCalls.length, 1);

        const body = json as { nonce: string; regenerate_nonce: string };
        assert.notEqual(body.nonce, "NoncePlaceholder");
        assert.notEqual(body.regenerate_nonce, "RegenNoncePlaceholder");
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "view", body.nonce), true);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", body.regenerate_nonce), true);
        assert.equal(verifyMfaBackupCodesChallengeNonce("user-a", "regenerate", body.nonce), false);
        assert.equal(authActionTokenInsertCalls.length, 2);
        assert.deepEqual(
            authActionTokenInsertCalls.map(({ user_id, purpose, consumed_at }) => ({ user_id, purpose, consumed_at })).sort((a, b) => a.purpose.localeCompare(b.purpose)),
            [
                { user_id: "user-a", purpose: getMfaBackupCodesChallengePurpose("regenerate"), consumed_at: null },
                { user_id: "user-a", purpose: getMfaBackupCodesChallengePurpose("view"), consumed_at: null },
            ],
        );
    });

    test("rejects arbitrary key and nonce before loading or returning backup codes", async () => {
        const { response, json } = await postJson(createApp(), {
            key: "anything",
            nonce: "attacker-controlled",
        });

        assert.equal(response.status, 400);
        assert.deepEqual(userFindCalls, []);
        assert.deepEqual(authActionTokenUpdateCalls, []);
        assert.deepEqual(backupFindCalls, []);
        assert.deepEqual(backupUpdateCalls, []);
        assert.match(JSON.stringify(json), /INVALID_BACKUP_CODE_NONCE/);
    });

    test("rejects a valid nonce for the wrong backup-code action", async () => {
        const viewNonce = await issueMfaBackupCodesChallengeNonce("user-a", "view");

        const { response, json } = await postJson(createApp(), {
            key: "correct-password",
            nonce: viewNonce,
            regenerate: true,
        });

        assert.equal(response.status, 400);
        assert.deepEqual(userFindCalls, []);
        assert.deepEqual(authActionTokenUpdateCalls, []);
        assert.deepEqual(backupFindCalls, []);
        assert.deepEqual(backupUpdateCalls, []);
        assert.match(JSON.stringify(json), /INVALID_BACKUP_CODE_NONCE/);
    });

    test("rejects a valid nonce when the password key is wrong", async () => {
        const nonce = await issueMfaBackupCodesChallengeNonce("user-a", "view");

        const { response, json } = await postJson(createApp(), {
            key: "wrong-password",
            nonce,
        });

        assert.equal(response.status, 400);
        assert.equal(userFindCalls.length, 1);
        assert.equal(authActionTokenUpdateCalls.length, 1);
        assert.deepEqual(backupFindCalls, []);
        assert.deepEqual(backupUpdateCalls, []);
        assert.match(JSON.stringify(json), /INVALID_PASSWORD/);
    });

    test("returns only the authenticated user's active backup codes after nonce and password verification", async () => {
        const nonce = await issueMfaBackupCodesChallengeNonce("user-a", "view");

        const { response, json } = await postJson(createApp(), {
            key: "correct-password",
            nonce,
        });

        assert.equal(response.status, 200);
        assert.equal(userFindCalls.length, 1);
        assert.equal(authActionTokenUpdateCalls.length, 1);
        assert.deepEqual(backupFindCalls, [
            {
                where: {
                    user: {
                        id: "user-a",
                    },
                    expired: false,
                },
            },
        ]);
        assert.deepEqual(backupUpdateCalls, []);
        assert.deepEqual(json, {
            backup_codes: [
                {
                    id: "backup-a",
                    code: "abcdef12",
                    consumed: false,
                    user: { id: "user-a" },
                },
            ],
        });
    });

    test("rejects replayed backup-code challenge nonces", async () => {
        const nonce = await issueMfaBackupCodesChallengeNonce("user-a", "view");

        const first = await postJson(createApp(), {
            key: "correct-password",
            nonce,
        });
        const second = await postJson(createApp(), {
            key: "correct-password",
            nonce,
        });

        assert.equal(first.response.status, 200);
        assert.equal(second.response.status, 400);
        assert.equal(authActionTokenUpdateCalls.length, 2);
        assert.equal(backupFindCalls.length, 1);
        assert.match(JSON.stringify(second.json), /INVALID_BACKUP_CODE_NONCE/);
    });

    test("regenerates backup codes only after regenerate nonce and password verification", async () => {
        const nonce = await issueMfaBackupCodesChallengeNonce("user-a", "regenerate");

        const { response, json } = await postJson(createApp(), {
            key: "correct-password",
            nonce,
            regenerate: true,
        });

        assert.equal(response.status, 200);
        assert.equal(userFindCalls.length, 1);
        assert.equal(authActionTokenUpdateCalls.length, 1);
        assert.deepEqual(backupFindCalls, []);
        assert.deepEqual(backupUpdateCalls, [
            {
                criteria: { user: { id: "user-a" } },
                partialEntity: { expired: true },
            },
        ]);
        assert.equal(savedBackupCodes.length, 10);
        assert.equal(
            savedBackupCodes.every((code) => code.user.id === "user-a" && code.consumed === false && code.expired === false),
            true,
        );

        const body = json as { backup_codes: Array<{ user: { id: string }; code: string; consumed: boolean; expired?: boolean }> };
        assert.equal(body.backup_codes.length, 10);
        assert.equal(
            body.backup_codes.every((code) => code.user.id === "user-a" && code.consumed === false && code.expired === undefined),
            true,
        );
    });
});

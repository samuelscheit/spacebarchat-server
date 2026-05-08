/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import jwt from "jsonwebtoken";
import type { AuthActionToken } from "../entities/AuthActionToken";
import type { InstanceBan } from "../entities/InstanceBan";
import type { Session } from "../entities/Session";
import type { User } from "../entities/User";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { FindOptionsRelations, FindOptionsSelect, IsNull, MoreThan } from "typeorm";
import { randomUpperString } from "./Random";
import { TimeSpan } from "./Timespan";
import { HTTPError } from "lambert-server";
import path from "node:path";
import { createTokenPayload, CurrentTokenFormatVersion, FirstTokenFormatVersionWithDeviceId, getTokenUserId, TokenPayload } from "./TokenPayload";
import { isRealGatewaySessionId } from "./GatewaySessions";
import {
    assertConsumableEmailActionTokenRecord,
    EmailActionTokenPayload,
    EmailActionTokenPurpose,
    getEmailActionTokenExpiresAt,
    hashEmailActionToken,
    isEmailActionTokenPayload,
} from "./EmailActionToken";
import { isAccessTokenPayload } from "./AuthTokenPayload";

export { createTokenPayload, CurrentTokenFormatVersion, FirstTokenFormatVersionWithDeviceId };

export type UserTokenData = {
    user: User;
    session?: Session;
    tokenVersion: number;
    decoded: TokenPayload;
};

function logAuth(text: string) {
    if (process.env.LOG_AUTH !== "true") return;
    console.log(`[AUTH] ${text}`);
}

function rejectAndLog(rejectFunction: (reason?: unknown) => void, httpCode: number | undefined, reason: string) {
    console.error(reason);
    rejectFunction(new HTTPError(reason, httpCode ?? 400));
}

export function userSelectFromKeys(keys: readonly (keyof User)[]): FindOptionsSelect<User> {
    return Object.fromEntries(keys.map((key) => [key, true])) as FindOptionsSelect<User>;
}

export function getCheckTokenUserSelect(select?: FindOptionsSelect<User>): FindOptionsSelect<User> {
    return {
        ...select,
        id: true,
        bot: true,
        disabled: true,
        deleted: true,
        rights: true,
        data: true,
    };
}

export type TokenEntityStores = {
    AuthActionToken: typeof AuthActionToken;
    InstanceBan: typeof InstanceBan;
    Session: typeof Session;
    User: typeof User;
};

let tokenEntityStores: TokenEntityStores | undefined;

function getTokenEntityStores() {
    return (tokenEntityStores ??= require("../entities") as TokenEntityStores);
}

function getConfig() {
    return (require("./Config") as typeof import("./Config")).Config;
}

export function setTokenEntityStoresForTests(stores: TokenEntityStores | undefined) {
    tokenEntityStores = stores;
}

export function getInvalidCurrentTokenSessionReason(decoded: Pick<UserTokenData["decoded"], "did">, tokenVersion: number, session?: Pick<Session, "session_id">) {
    if (tokenVersion >= FirstTokenFormatVersionWithDeviceId && !isRealGatewaySessionId(decoded.did)) return "Current token has no real session id";
    if (decoded.did && (!session || session.session_id !== decoded.did)) return "Current token session was not found";
    return undefined;
}

export const checkToken = (
    token: string,
    opts?: {
        select?: FindOptionsSelect<User>;
        relations?: FindOptionsRelations<User>;
        ipAddress?: string;
        fingerprint?: string;
    },
): Promise<UserTokenData> =>
    new Promise((resolve, reject) => {
        token = token.replace("Bot ", ""); // there is no bot distinction in sb
        token = token.replace("Bearer ", ""); // allow bearer tokens

        let legacyVersion: number | undefined = undefined;

        const validateUser: jwt.VerifyCallback = async (err, out) => {
            const decoded = out as UserTokenData["decoded"];
            if (err || !decoded) {
                logAuth("validateUser rejected: " + err);
                return rejectAndLog(reject, 401, "Invalid Token meow " + err);
            }
            if (isEmailActionTokenPayload(decoded)) {
                logAuth("validateUser rejected: email action token");
                return rejectAndLog(reject, 401, "Invalid Token");
            }
            if (!isAccessTokenPayload(decoded)) {
                logAuth("validateUser rejected: not an access token");
                return rejectAndLog(reject, 401, "Invalid Token");
            }
            const userId = getTokenUserId(decoded);
            if (!userId) {
                logAuth("validateUser rejected: Missing user id claim");
                return rejectAndLog(reject, 401, "Invalid Token");
            }

            const { InstanceBan, Session, User } = getTokenEntityStores();

            // eslint-disable-next-line prefer-const
            let [user, session] = await Promise.all([
                User.findOne({
                    where: { id: userId },
                    select: getCheckTokenUserSelect(opts?.select),
                    relations: opts?.relations,
                }),
                decoded.did ? Session.findOne({ where: { session_id: decoded.did, user_id: userId } }) : undefined,
            ]);

            if (decoded.did && !session) {
                logAuth("validateUser rejected: Session not found");
                return rejectAndLog(reject, 401, "Invalid Session");
            }

            if (!user) {
                logAuth("validateUser rejected: User not found");
                return rejectAndLog(reject, 401, "User not found");
            }

            // we need to round it to seconds as it saved as seconds in jwt iat and valid_tokens_since is stored in milliseconds
            if (decoded.iat * 1000 < new Date(user.data.valid_tokens_since).setSeconds(0, 0)) {
                logAuth("validateUser rejected: Token not yet valid");
                return rejectAndLog(reject, 401, "Invalid Token");
            }

            if (user.disabled) {
                logAuth("validateUser rejected: User disabled");
                return rejectAndLog(reject, 401, "User disabled");
            }

            if (user.deleted) {
                logAuth("validateUser rejected: User deleted");
                return rejectAndLog(reject, 401, "User not found");
            }

            const tokenVersion = decoded.ver ?? legacyVersion ?? 2;
            const invalidCurrentTokenSessionReason = getInvalidCurrentTokenSessionReason(decoded, tokenVersion, session ?? undefined);
            if (invalidCurrentTokenSessionReason) {
                logAuth("validateUser rejected: " + invalidCurrentTokenSessionReason);
                return rejectAndLog(reject, 401, "Invalid Token");
            }

            const banReasons = await InstanceBan.findInstanceBans({ userId: user.id, ipAddress: opts?.ipAddress, fingerprint: opts?.fingerprint, propagateBan: true });
            if (banReasons.length > 0) {
                logAuth("validateUser rejected: User banned for reasons: " + banReasons.join(", "));
                return rejectAndLog(reject, 418, "Invalid Token");
            }

            if (session && TimeSpan.fromDates(session.last_seen?.getTime() ?? 0, new Date().getTime()).totalSeconds >= 15) {
                session.last_seen = new Date();
                let updateIpInfoPromise;
                if (opts?.ipAddress && opts?.ipAddress !== session.last_seen_ip) {
                    session.last_seen_ip = opts.ipAddress;
                    updateIpInfoPromise = session.updateIpInfo();
                }
                await Promise.all([session.save(), updateIpInfoPromise]);
            }

            const result: UserTokenData = {
                decoded,
                session: session ?? undefined,
                user,
                // v1 can be told apart, v2 cant outside of missing device id and version
                tokenVersion,
            };

            if (process.env.LOG_TOKEN_VERSION) console.log("User", user.id, "logged in with token version", result.tokenVersion);

            logAuth("validateUser success: " + JSON.stringify(result));
            return resolve(result);
        };

        const dec = jwt.decode(token, { complete: true });
        if (!dec) return void rejectAndLog(reject, 401, "Invalid Token");
        logAuth("Decoded token: " + JSON.stringify(dec));

        if (dec.header.alg == "HS256" && getConfig().get().security.jwtSecret !== null) {
            legacyVersion = 1;
            jwt.verify(token, getConfig().get().security.jwtSecret!, { algorithms: ["HS256"] }, validateUser);
        } else if (dec.header.alg == "ES512") {
            loadOrGenerateKeypair().then((keyPair) => {
                jwt.verify(token, keyPair.publicKey, { algorithms: ["ES512"] }, validateUser);
            });
        } else return void rejectAndLog(reject, 400, "Unsupported token algorithm: " + dec.header.alg);
    });

export async function generateTokenForSession(id: string, session: Pick<Session, "session_id"> | string): Promise<string | undefined> {
    const keyPair = await loadOrGenerateKeypair();
    const session_id = typeof session === "string" ? session : session.session_id;
    if (!isRealGatewaySessionId(session_id)) throw new Error("Cannot generate a token for an invalid session id");
    const iat = Math.floor(Date.now() / 1000);

    return new Promise((res, rej) => {
        jwt.sign(
            createTokenPayload(id, iat, keyPair.fingerprint, session_id),
            keyPair.privateKey,
            {
                algorithm: "ES512",
            },
            (err, token) => {
                if (err) return rej(err);
                return res(token);
            },
        );
    });
}

export async function generateToken(id: string, isAdminSession: boolean = false): Promise<string | undefined> {
    const { Session } = getTokenEntityStores();
    let newSession;
    do {
        newSession = Session.create({
            session_id: randomUpperString(10), // readable at a glance
            user_id: id,
            is_admin_session: isAdminSession,
            client_status: {},
            status: "offline", // will be set to online upon IDENTIFY
            client_info: {},
        });
    } while (await Session.findOne({ where: { session_id: newSession.session_id } }));

    await newSession.save();

    return generateTokenForSession(id, newSession);
}

function signJwt<T extends object>(payload: T, privateKey: crypto.KeyObject): Promise<string> {
    return new Promise((res, rej) => {
        jwt.sign(
            payload,
            privateKey,
            {
                algorithm: "ES512",
            },
            (err, token) => {
                if (err) return rej(err);
                return res(token!);
            },
        );
    });
}

export async function generateEmailActionToken(id: string, purpose: EmailActionTokenPurpose, email?: string): Promise<string> {
    const { AuthActionToken } = getTokenEntityStores();
    const issuedAt = new Date();
    const iat = Math.floor(issuedAt.getTime() / 1000);
    const expiresAt = getEmailActionTokenExpiresAt(purpose, issuedAt);
    const keyPair = await loadOrGenerateKeypair();

    const payload: EmailActionTokenPayload = {
        id,
        iat,
        exp: Math.floor(expiresAt.getTime() / 1000),
        kid: keyPair.fingerprint,
        typ: "email_action",
        purpose,
        nonce: crypto.randomBytes(32).toString("base64url"),
        email,
        ver: 1,
    };

    const token = await signJwt(payload, keyPair.privateKey);
    await AuthActionToken.update({ user_id: id, purpose, consumed_at: IsNull() }, { consumed_at: issuedAt });
    await AuthActionToken.insert({
        token_hash: hashEmailActionToken(token),
        user_id: id,
        purpose,
        email: email ?? null,
        expires_at: expiresAt,
        consumed_at: null,
    });

    return token;
}

async function verifySignedEmailActionToken(token: string, purpose: EmailActionTokenPurpose): Promise<EmailActionTokenPayload> {
    token = token.replace("Bearer ", "");

    const dec = jwt.decode(token, { complete: true });
    if (!dec) throw new HTTPError("Invalid email action token", 401);
    if (dec.header.alg !== "ES512") throw new HTTPError("Unsupported token algorithm: " + dec.header.alg, 400);

    const keyPair = await loadOrGenerateKeypair();
    return new Promise((resolve, reject) => {
        jwt.verify(token, keyPair.publicKey, { algorithms: ["ES512"] }, (err, out) => {
            if (err || !isEmailActionTokenPayload(out)) return reject(new HTTPError("Invalid email action token", 401));
            if (out.purpose !== purpose) return reject(new HTTPError("Invalid email action token purpose", 401));
            return resolve(out);
        });
    });
}

export async function verifyEmailActionToken(token: string, purpose: EmailActionTokenPurpose): Promise<User> {
    const { AuthActionToken, User } = getTokenEntityStores();
    token = token.replace("Bearer ", "");
    const decoded = await verifySignedEmailActionToken(token, purpose);
    const now = new Date();
    const tokenHash = hashEmailActionToken(token);
    const tokenRecord = await AuthActionToken.findOne({
        where: {
            token_hash: tokenHash,
            user_id: decoded.id,
            purpose,
            consumed_at: IsNull(),
            expires_at: MoreThan(now),
        },
    });
    assertConsumableEmailActionTokenRecord(tokenRecord, purpose, token, now, decoded.email);

    const user = await User.findOne({
        where: { id: decoded.id },
        select: getCheckTokenUserSelect(userSelectFromKeys(["email", "verified"])),
    });

    if (!user || user.disabled || user.deleted) throw new HTTPError("Invalid email action token", 401);
    if (tokenRecord?.email && tokenRecord.email !== user.email) throw new HTTPError("Invalid email action token", 401);

    const consumed = await AuthActionToken.update(
        {
            token_hash: tokenHash,
            consumed_at: IsNull(),
            expires_at: MoreThan(now),
        },
        { consumed_at: now },
    );
    if (consumed.affected !== 1) throw new HTTPError("Invalid email action token", 401);

    return user;
}

let lastFsCheck: number;
let cachedKeypair: {
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
    fingerprint: string;
};

// Get ECDSA keypair from file or generate it
export async function loadOrGenerateKeypair() {
    if (cachedKeypair) {
        // check for file deletion every minute
        if (Date.now() - lastFsCheck > 60000) {
            if (!existsSync("jwt.key") || !existsSync("jwt.key.pub")) {
                console.log("[JWT] Keypair files disappeared... Saving them again.");
                await Promise.all([
                    fs.writeFile("jwt.key", cachedKeypair.privateKey.export({ format: "pem", type: "sec1" })),
                    fs.writeFile("jwt.key.pub", cachedKeypair.publicKey.export({ format: "pem", type: "spki" })),
                ]);
            }
            lastFsCheck = Date.now();
        }

        return cachedKeypair;
    }

    let privateKey: crypto.KeyObject;
    let publicKey: crypto.KeyObject;

    if (existsSync("jwt.key") && existsSync("jwt.key.pub")) {
        const [loadedPrivateKey, loadedPublicKey] = await Promise.all([fs.readFile("jwt.key"), fs.readFile("jwt.key.pub")]);

        privateKey = crypto.createPrivateKey(loadedPrivateKey);
        publicKey = crypto.createPublicKey(loadedPublicKey);
    } else {
        console.log("[JWT] Generating new keypair:", path.resolve("jwt.key"), "- PWD:", process.cwd());
        const res = crypto.generateKeyPairSync("ec", {
            namedCurve: "secp521r1",
        });
        privateKey = res.privateKey;
        publicKey = res.publicKey;

        await Promise.all([
            fs.writeFile("jwt.key", privateKey.export({ format: "pem", type: "sec1" })),
            fs.writeFile("jwt.key.pub", publicKey.export({ format: "pem", type: "spki" })),
        ]);
    }

    const fingerprint = crypto
        .createHash("sha256")
        .update(publicKey.export({ format: "pem", type: "spki" }))
        .digest("hex");

    lastFsCheck = Date.now();
    return (cachedKeypair = { privateKey, publicKey, fingerprint });
}

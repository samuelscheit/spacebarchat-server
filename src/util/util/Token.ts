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
import { Config } from "./Config";
import { AuthActionToken, InstanceBan, Session, User } from "../entities";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
// TODO: dont use deprecated APIs lol
import { FindOptionsRelationByString, FindOptionsSelectByString, IsNull, MoreThan } from "typeorm";
import { randomUpperString } from "@spacebar/api";
import { TimeSpan } from "./Timespan";
import { HTTPError } from "lambert-server";
import path from "node:path";
import {
    assertConsumableEmailActionTokenRecord,
    EmailActionTokenPayload,
    EmailActionTokenPurpose,
    getEmailActionTokenExpiresAt,
    hashEmailActionToken,
    isEmailActionTokenPayload,
} from "./EmailActionToken";
import { AccessTokenPayload, CurrentTokenFormatVersion, isAccessTokenPayload } from "./AuthTokenPayload";

export type UserTokenData = {
    user: User;
    session?: Session;
    tokenVersion: number;
    decoded: AccessTokenPayload;
};

function logAuth(text: string) {
    if (process.env.LOG_AUTH !== "true") return;
    console.log(`[AUTH] ${text}`);
}

function rejectAndLog(rejectFunction: (reason?: unknown) => void, httpCode: number | undefined, reason: string) {
    console.error(reason);
    rejectFunction(new HTTPError(reason, httpCode ?? 400));
}

export const checkToken = (
    token: string,
    opts?: {
        select?: FindOptionsSelectByString<User>;
        relations?: FindOptionsRelationByString;
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

            // eslint-disable-next-line prefer-const
            let [user, session] = await Promise.all([
                User.findOne({
                    where: { id: decoded.id },
                    select: [...(opts?.select || []), "id", "bot", "disabled", "deleted", "rights", "data"],
                    relations: opts?.relations,
                }),
                decoded.did ? Session.findOne({ where: { session_id: decoded.did, user_id: decoded.id } }) : undefined,
            ]);

            if (!user) {
                logAuth("validateUser rejected: User not found");
                return rejectAndLog(reject, 401, "User not found");
            }

            if (!session) {
                logAuth("validateUser rejected: Session not found");
                return rejectAndLog(reject, 401, "Invalid Token");
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
                tokenVersion: decoded.ver ?? legacyVersion ?? 2,
            };

            if (process.env.LOG_TOKEN_VERSION) console.log("User", user.id, "logged in with token version", result.tokenVersion);

            logAuth("validateUser success: " + JSON.stringify(result));
            return resolve(result);
        };

        const dec = jwt.decode(token, { complete: true });
        if (!dec) return void rejectAndLog(reject, 500, "Failed to decode token");
        logAuth("Decoded token: " + JSON.stringify(dec));

        if (dec.header.alg == "HS256" && Config.get().security.jwtSecret !== null) {
            legacyVersion = 1;
            jwt.verify(token, Config.get().security.jwtSecret!, { algorithms: ["HS256"] }, validateUser);
        } else if (dec.header.alg == "ES512") {
            loadOrGenerateKeypair().then((keyPair) => {
                jwt.verify(token, keyPair.publicKey, { algorithms: ["ES512"] }, validateUser);
            });
        } else return void rejectAndLog(reject, 400, "Unsupported token algorithm: " + dec.header.alg);
    });

export async function generateToken(id: string, isAdminSession: boolean = false): Promise<string | undefined> {
    const iat = Math.floor(Date.now() / 1000);
    const keyPair = await loadOrGenerateKeypair();

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

    return new Promise((res, rej) => {
        const payload = { id, iat, kid: keyPair.fingerprint, typ: "access", ver: CurrentTokenFormatVersion, did: newSession.session_id } as UserTokenData["decoded"];
        jwt.sign(
            payload,
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
        select: ["id", "email", "verified", "disabled", "deleted", "data"],
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

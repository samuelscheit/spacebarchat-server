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
import type { InstanceBan } from "../entities/InstanceBan";
import type { Session } from "../entities/Session";
import type { User } from "../entities/User";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
// TODO: dont use deprecated APIs lol
import { FindOptionsRelationByString, FindOptionsSelectByString } from "typeorm";
import { TimeSpan } from "./Timespan";
import { HTTPError } from "lambert-server";
import path from "node:path";
import { isRealGatewaySessionId } from "./GatewaySessions";

/// Change history:
/// 1 - Initial version with HS256
/// 2 - Switched to ES512
/// 3 - Add version, device id to token payload
export const CurrentTokenFormatVersion: number = 3;

export type UserTokenData = {
    user: User;
    session?: Session;
    tokenVersion: number;
    decoded: {
        id: string;
        iat: number;
        // token format version
        ver?: number;
        // device id
        did?: string;
        kid?: string;
    };
};

function logAuth(text: string) {
    if (process.env.LOG_AUTH !== "true") return;
    console.log(`[AUTH] ${text}`);
}

function rejectAndLog(rejectFunction: (reason?: unknown) => void, httpCode: number | undefined, reason: string) {
    console.error(reason);
    rejectFunction(new HTTPError(reason, httpCode ?? 400));
}

function randomUpperString(length: number = 10) {
    return (require("@spacebar/api") as { randomUpperString(length?: number): string }).randomUpperString(length);
}

export type TokenEntityStores = {
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
    if (tokenVersion !== CurrentTokenFormatVersion) return undefined;
    if (!isRealGatewaySessionId(decoded.did)) return "Current token has no real session id";
    if (!session || session.session_id !== decoded.did) return "Current token session was not found";
    return undefined;
}

export function createTokenPayload(id: string, session_id: string, keyFingerprint: string, iat: number = Math.floor(Date.now() / 1000)) {
    return {
        id,
        iat,
        kid: keyFingerprint,
        ver: CurrentTokenFormatVersion,
        did: session_id,
    } satisfies UserTokenData["decoded"] & { kid: string; ver: number; did: string };
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

            const { InstanceBan, Session, User } = getTokenEntityStores();

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
        if (!dec) return void rejectAndLog(reject, 500, "Failed to decode token");
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

    return new Promise((res, rej) => {
        jwt.sign(
            createTokenPayload(id, session_id, keyPair.fingerprint),
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

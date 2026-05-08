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

import crypto from "node:crypto";
import { AuthActionToken, Config } from "@spacebar/util";
import { IsNull, MoreThan } from "typeorm";

export type MfaBackupCodesChallengeAction = "view" | "regenerate";

export const MFA_BACKUP_CODES_CHALLENGE_TTL = 5 * 60 * 1000;
export const MFA_BACKUP_CODES_CHALLENGE_PURPOSE_PREFIX = "mfa_backup_codes:";

interface MfaBackupCodesChallengePayload {
    v: 1;
    user_id: string;
    action: MfaBackupCodesChallengeAction;
    iat: number;
    exp: number;
    nonce: string;
}

export interface MfaBackupCodesChallengeStateStore {
    insert(record: { token_hash: string; user_id: string; purpose: string; expires_at: Date; consumed_at: Date | null }): Promise<unknown>;
    update(criteria: unknown, partialEntity: { consumed_at: Date }): Promise<{ affected?: number | null }>;
}

export interface MfaBackupCodesChallengeOptions {
    now?: number;
    secret?: string;
    randomBytes?: (size: number) => Buffer;
}

export interface StoredMfaBackupCodesChallengeOptions extends MfaBackupCodesChallengeOptions {
    stateStore?: MfaBackupCodesChallengeStateStore;
}

export interface MfaBackupCodesChallengeVerifyOptions {
    now?: number;
    secret?: string;
}

export interface ConsumeMfaBackupCodesChallengeOptions extends MfaBackupCodesChallengeVerifyOptions {
    stateStore?: MfaBackupCodesChallengeStateStore;
}

const uninitializedConfigChallengeSecret = crypto.randomBytes(32).toString("base64");

function getChallengeSecret(secret?: string) {
    if (secret) return secret;

    const configuredSecret = Config.get().security.requestSignature;
    const stableConfiguredSecret = Config.get().security.requestSignature;

    if (configuredSecret === stableConfiguredSecret) return configuredSecret;

    return uninitializedConfigChallengeSecret;
}

function getStateStore(stateStore?: MfaBackupCodesChallengeStateStore) {
    return stateStore ?? (AuthActionToken as unknown as MfaBackupCodesChallengeStateStore);
}

function encodeBase64Url(value: string | Buffer) {
    return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadSegment: string, secret: string) {
    return crypto.createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

function hasValidSignature(payloadSegment: string, signatureSegment: string, secret: string) {
    const expected = Buffer.from(signPayload(payloadSegment, secret), "base64url");
    const actual = Buffer.from(signatureSegment, "base64url");

    if (expected.length !== actual.length) return false;

    return crypto.timingSafeEqual(expected, actual);
}

function isChallengePayload(value: unknown): value is MfaBackupCodesChallengePayload {
    if (!value || typeof value !== "object") return false;

    const payload = value as Partial<MfaBackupCodesChallengePayload>;
    return (
        payload.v === 1 &&
        typeof payload.user_id === "string" &&
        (payload.action === "view" || payload.action === "regenerate") &&
        typeof payload.iat === "number" &&
        typeof payload.exp === "number" &&
        typeof payload.nonce === "string"
    );
}

export function getMfaBackupCodesChallengePurpose(action: MfaBackupCodesChallengeAction) {
    return `${MFA_BACKUP_CODES_CHALLENGE_PURPOSE_PREFIX}${action}`;
}

export function hashMfaBackupCodesChallengeNonce(nonce: string) {
    return crypto.createHash("sha256").update(nonce).digest("hex");
}

function readMfaBackupCodesChallengePayload(user_id: string, action: MfaBackupCodesChallengeAction, nonce: string, options: MfaBackupCodesChallengeVerifyOptions = {}) {
    const [payloadSegment, signatureSegment, ...extraSegments] = nonce.split(".");
    if (!payloadSegment || !signatureSegment || extraSegments.length > 0) return undefined;

    const secret = getChallengeSecret(options.secret);
    if (!hasValidSignature(payloadSegment, signatureSegment, secret)) return undefined;

    let payload: unknown;
    try {
        payload = JSON.parse(decodeBase64Url(payloadSegment));
    } catch {
        return undefined;
    }

    if (!isChallengePayload(payload)) return undefined;

    const now = options.now ?? Date.now();
    if (payload.user_id !== user_id) return undefined;
    if (payload.action !== action) return undefined;
    if (payload.exp <= now) return undefined;
    if (payload.iat > now + 30 * 1000) return undefined;

    return payload;
}

export function createMfaBackupCodesChallengeNonce(user_id: string, action: MfaBackupCodesChallengeAction, options: MfaBackupCodesChallengeOptions = {}) {
    const now = options.now ?? Date.now();
    const randomBytes = options.randomBytes ?? crypto.randomBytes;
    const payload: MfaBackupCodesChallengePayload = {
        v: 1,
        user_id,
        action,
        iat: now,
        exp: now + MFA_BACKUP_CODES_CHALLENGE_TTL,
        nonce: randomBytes(16).toString("base64url"),
    };

    const payloadSegment = encodeBase64Url(JSON.stringify(payload));
    const signatureSegment = signPayload(payloadSegment, getChallengeSecret(options.secret));

    return `${payloadSegment}.${signatureSegment}`;
}

export async function issueMfaBackupCodesChallengeNonce(user_id: string, action: MfaBackupCodesChallengeAction, options: StoredMfaBackupCodesChallengeOptions = {}) {
    const now = options.now ?? Date.now();
    const nonce = createMfaBackupCodesChallengeNonce(user_id, action, { ...options, now });

    await getStateStore(options.stateStore).insert({
        token_hash: hashMfaBackupCodesChallengeNonce(nonce),
        user_id,
        purpose: getMfaBackupCodesChallengePurpose(action),
        expires_at: new Date(now + MFA_BACKUP_CODES_CHALLENGE_TTL),
        consumed_at: null,
    });

    return nonce;
}

export function verifyMfaBackupCodesChallengeNonce(user_id: string, action: MfaBackupCodesChallengeAction, nonce: string, options: MfaBackupCodesChallengeVerifyOptions = {}) {
    return !!readMfaBackupCodesChallengePayload(user_id, action, nonce, options);
}

export async function consumeMfaBackupCodesChallengeNonce(
    user_id: string,
    action: MfaBackupCodesChallengeAction,
    nonce: string,
    options: ConsumeMfaBackupCodesChallengeOptions = {},
) {
    const payload = readMfaBackupCodesChallengePayload(user_id, action, nonce, options);
    if (!payload) return false;

    const now = options.now ?? Date.now();
    const result = await getStateStore(options.stateStore).update(
        {
            token_hash: hashMfaBackupCodesChallengeNonce(nonce),
            user_id,
            purpose: getMfaBackupCodesChallengePurpose(action),
            consumed_at: IsNull(),
            expires_at: MoreThan(new Date(now)),
        },
        { consumed_at: new Date(now) },
    );

    return result.affected === 1;
}

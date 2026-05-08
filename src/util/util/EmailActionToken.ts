/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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
import { HTTPError } from "lambert-server";

export enum EmailActionTokenPurpose {
    verifyEmail = "verify_email",
    resetPassword = "reset_password",
}

export const EmailActionTokenLifetimeSeconds: Record<EmailActionTokenPurpose, number> = {
    [EmailActionTokenPurpose.verifyEmail]: 24 * 60 * 60,
    [EmailActionTokenPurpose.resetPassword]: 60 * 60,
};

export type EmailActionTokenPayload = {
    id: string;
    iat: number;
    exp: number;
    kid: string;
    typ: "email_action";
    purpose: EmailActionTokenPurpose;
    nonce: string;
    email?: string;
    ver: 1;
};

export type EmailActionTokenState = {
    token_hash: string;
    expires_at: string;
};

export type EmailActionTokenRecord = {
    token_hash: string;
    purpose: string;
    user_id: string;
    email?: string | null;
    expires_at: Date | string;
    consumed_at?: Date | string | null;
};

export function isEmailActionTokenPurpose(value: unknown): value is EmailActionTokenPurpose {
    return value === EmailActionTokenPurpose.verifyEmail || value === EmailActionTokenPurpose.resetPassword;
}

export function isEmailActionTokenPayload(value: unknown): value is EmailActionTokenPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as Partial<EmailActionTokenPayload>;
    return (
        payload.typ === "email_action" &&
        typeof payload.id === "string" &&
        typeof payload.iat === "number" &&
        typeof payload.exp === "number" &&
        typeof payload.kid === "string" &&
        typeof payload.nonce === "string" &&
        payload.ver === 1 &&
        isEmailActionTokenPurpose(payload.purpose)
    );
}

export function hashEmailActionToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function getEmailActionTokenExpiresAt(purpose: EmailActionTokenPurpose, now: Date = new Date()) {
    return new Date(now.getTime() + EmailActionTokenLifetimeSeconds[purpose] * 1000);
}

export function assertConsumableEmailActionTokenRecord(
    record: EmailActionTokenRecord | null | undefined,
    purpose: EmailActionTokenPurpose,
    token: string,
    now: Date = new Date(),
    email?: string,
) {
    if (!record) throw new HTTPError("Invalid email action token", 401);
    if (record.purpose !== purpose) throw new HTTPError("Invalid email action token purpose", 401);
    if (record.consumed_at) throw new HTTPError("Invalid email action token", 401);
    if (new Date(record.expires_at).getTime() <= now.getTime()) throw new HTTPError("Expired email action token", 401);
    if (record.token_hash !== hashEmailActionToken(token)) throw new HTTPError("Invalid email action token", 401);
    if (record.email && record.email !== email) throw new HTTPError("Invalid email action token", 401);

    return record;
}

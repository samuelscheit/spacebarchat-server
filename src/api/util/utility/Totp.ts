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

import { verifyToken } from "node-2fa";
import { User } from "@spacebar/util";
import { HTTPError } from "lambert-server";

type VerifyTotpToken = typeof verifyToken;

export interface MfaBackupCodeUpdateBuilder {
    andWhere(query: string, parameters: Record<string, unknown>): MfaBackupCodeUpdateBuilder;
    execute(): Promise<{ affected?: number | null }>;
    set(values: { consumed: boolean }): MfaBackupCodeUpdateBuilder;
    update(entity: unknown): MfaBackupCodeUpdateBuilder;
    where(query: string, parameters: Record<string, unknown>): MfaBackupCodeUpdateBuilder;
}

export interface ConsumeMfaBackupCodeOptions {
    backupCodeEntity?: unknown;
    code: string;
    createQueryBuilder?: () => unknown;
    manager?: { createQueryBuilder(): unknown };
    userId: string;
}

export interface AssertMfaCodeOptions {
    code: unknown;
    consumeBackupCode(code: string): Promise<boolean>;
    invalidCodeError: () => Error;
    mfa_enabled: boolean;
    totp_secret: string | null | undefined;
    verifyTotpToken?: VerifyTotpToken;
}

export function isCurrentTotpCode(secret: string | null | undefined, code: unknown, verifier: VerifyTotpToken = verifyToken): boolean {
    if (!secret || typeof code !== "string") return false;

    const result = verifier(secret, code);
    return !!result && result.delta === 0;
}

function getBackupCodeEntity() {
    const { BackupCode } = require("@spacebar/util") as { BackupCode: { createQueryBuilder(): unknown } };
    return BackupCode;
}

export async function consumeMfaBackupCode({ backupCodeEntity, code, createQueryBuilder, manager, userId }: ConsumeMfaBackupCodeOptions) {
    const backupCode = backupCodeEntity ?? getBackupCodeEntity();
    const queryBuilder = createQueryBuilder?.() ?? manager?.createQueryBuilder() ?? (backupCode as { createQueryBuilder(): unknown }).createQueryBuilder();

    const result = await (queryBuilder as MfaBackupCodeUpdateBuilder)
        .update(backupCode)
        .set({ consumed: true })
        .where("code = :code", { code })
        .andWhere("expired = :expired", { expired: false })
        .andWhere("consumed = :consumed", { consumed: false })
        .andWhere("user_id = :userId", { userId })
        .execute();

    return result.affected === 1;
}

export async function assertMfaCode({ code, consumeBackupCode, invalidCodeError, mfa_enabled, totp_secret, verifyTotpToken }: AssertMfaCodeOptions) {
    if (!mfa_enabled) return;

    if (typeof code !== "string" || !code) throw invalidCodeError();

    const backupConsumed = await consumeBackupCode(code);
    if (backupConsumed) return;

    if (!isCurrentTotpCode(totp_secret, code, verifyTotpToken)) throw invalidCodeError();
}

export function requireValidTotpCodeIfConfigured(totpSecret: string | null | undefined, code: unknown, invalidMessage: string): void {
    if (totpSecret && !isCurrentTotpCode(totpSecret, code)) {
        throw new HTTPError(invalidMessage, 60008);
    }
}

export async function requireTotpCodeIfConfigured(userId: string, code: unknown, invalidMessage: string): Promise<void> {
    const user = await User.findOneOrFail({
        where: { id: userId },
        select: { id: true, totp_secret: true },
    });

    requireValidTotpCodeIfConfigured(user.totp_secret, code, invalidMessage);
}

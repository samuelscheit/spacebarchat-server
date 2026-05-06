import { verifyToken } from "node-2fa";

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
    code: string | undefined;
    consumeBackupCode(code: string): Promise<boolean>;
    invalidCodeError: () => Error;
    mfa_enabled: boolean;
    totp_secret: string | undefined;
    verifyTotpToken?: VerifyTotpToken;
}

export function isValidTotpCode(secret: string | undefined, code: string | undefined, verifier: VerifyTotpToken = verifyToken) {
    if (!secret || !code) return false;

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

    if (!code) throw invalidCodeError();

    const backupConsumed = await consumeBackupCode(code);
    if (backupConsumed) return;

    if (!isValidTotpCode(totp_secret, code, verifyTotpToken)) throw invalidCodeError();
}

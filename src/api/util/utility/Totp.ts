import { verifyToken } from "node-2fa";

type VerifyTotpToken = typeof verifyToken;

export interface MfaBackupCodeChallenge {
    consumed: boolean;
    save(): Promise<unknown>;
}

export interface AssertMfaCodeOptions {
    code: string | undefined;
    invalidCodeError: () => Error;
    mfa_enabled: boolean;
    totp_secret: string | undefined;
    findBackupCode(code: string): Promise<MfaBackupCodeChallenge | null | undefined>;
}

export function isValidTotpCode(secret: string | undefined, code: string | undefined, verifier: VerifyTotpToken = verifyToken) {
    if (!secret || !code) return false;

    const result = verifier(secret, code);
    return !!result && result.delta === 0;
}

export async function assertMfaCode({ code, invalidCodeError, mfa_enabled, totp_secret, findBackupCode }: AssertMfaCodeOptions) {
    if (!mfa_enabled) return;

    const backup = code ? await findBackupCode(code) : undefined;
    if (!backup && !isValidTotpCode(totp_secret, code)) throw invalidCodeError();

    if (backup) {
        backup.consumed = true;
        await backup.save();
    }
}

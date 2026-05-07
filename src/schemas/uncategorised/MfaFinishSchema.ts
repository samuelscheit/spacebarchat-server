export interface MfaFinishSchema {
    ticket: string;
    mfa_type: "password" | "totp";
    data: string;
}

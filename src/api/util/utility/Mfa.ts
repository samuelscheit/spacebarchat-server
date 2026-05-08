import crypto from "node:crypto";
import { consumeMfaBackupCode, isCurrentTotpCode } from "./Totp";

export const RECENT_MFA_COOKIE = "__Secure-recent_mfa";
export const RECENT_MFA_HEADER = "x-discord-mfa-authorization";
export const RECENT_MFA_MAX_AGE_SECONDS = 5 * 60;
export const MFA_REQUIRED_CODE = 60003;
export const MFA_ACTION_TOTP_ENABLE = "totp_enable";

type MfaTokenPrefix = "mfa" | "mfa_ticket";
type MfaPayloadType = MfaTokenPrefix;

export type MfaAction = typeof MFA_ACTION_TOTP_ENABLE;

export interface MfaTokenContext {
    userId: string;
    action: MfaAction;
    sessionId: string | undefined;
}

export interface MfaRequiredResponseBody {
    message: string;
    code: typeof MFA_REQUIRED_CODE;
    mfa: {
        ticket: string;
        methods: { type: "password" }[];
    };
}

interface TimedMfaPayload {
    token_type: MfaPayloadType;
    user_id: string;
    action: MfaAction;
    session_id?: string;
    iat: number;
    exp: number;
    nonce: string;
}

interface RecentMfaTokenPayload extends TimedMfaPayload {
    token_type: "mfa";
}

export interface MfaTicketPayload extends TimedMfaPayload {
    token_type: "mfa_ticket";
}

export function createMfaRequiredResponse(ticket: string): MfaRequiredResponseBody {
    return {
        message: "Two factor is required for this operation",
        code: MFA_REQUIRED_CODE,
        mfa: {
            ticket,
            methods: [{ type: "password" }],
        },
    };
}

export function getRecentMfaToken(headers: { [key: string]: string | string[] | undefined }): string | undefined {
    const header = headers[RECENT_MFA_HEADER];
    if (typeof header === "string" && header) return header;
    if (Array.isArray(header) && header[0]) return header[0];

    const cookie = headers.cookie;
    if (typeof cookie !== "string") return undefined;

    return cookie
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(`${RECENT_MFA_COOKIE}=`))
        ?.slice(RECENT_MFA_COOKIE.length + 1);
}

export function createRecentMfaCookie(token: string): string {
    return `${RECENT_MFA_COOKIE}=${encodeURIComponent(token)}; Max-Age=${RECENT_MFA_MAX_AGE_SECONDS}; Path=/; Secure; HttpOnly; SameSite=None`;
}

export function clearRecentMfaCookie(): string {
    return `${RECENT_MFA_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=None`;
}

export function signRecentMfaToken(context: MfaTokenContext, secret: string, now = Date.now()): string {
    return signMfaPayload("mfa", createTimedMfaPayload("mfa", context, now), secret);
}

export function signMfaTicket(context: MfaTokenContext, secret: string, now = Date.now()): string {
    return signMfaPayload("mfa_ticket", createTimedMfaPayload("mfa_ticket", context, now), secret);
}

function createTimedMfaPayload(prefix: "mfa", context: MfaTokenContext, now?: number): RecentMfaTokenPayload;
function createTimedMfaPayload(prefix: "mfa_ticket", context: MfaTokenContext, now?: number): MfaTicketPayload;
function createTimedMfaPayload(prefix: MfaTokenPrefix, context: MfaTokenContext, now = Date.now()): RecentMfaTokenPayload | MfaTicketPayload {
    return {
        token_type: prefix,
        user_id: context.userId,
        action: context.action,
        session_id: context.sessionId,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + RECENT_MFA_MAX_AGE_SECONDS,
        nonce: crypto.randomBytes(16).toString("base64url"),
    };
}

function signMfaPayload(prefix: MfaTokenPrefix, payload: RecentMfaTokenPayload | MfaTicketPayload, secret: string): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signedData = `${prefix}.${encodedPayload}`;
    const signature = crypto.createHmac("sha256", secret).update(signedData).digest("base64url");

    return `${signedData}.${signature}`;
}

export function verifyRecentMfaToken(token: string | undefined, context: MfaTokenContext, secret: string, now = Date.now()): boolean {
    const payload = verifyMfaPayload(token, "mfa", secret, now);
    return !!payload && payload.user_id === context.userId && payload.action === context.action && !!payload.session_id && payload.session_id === context.sessionId;
}

export function verifyMfaTicket(token: string | undefined, secret: string, now = Date.now()): MfaTicketPayload | undefined {
    const payload = verifyMfaPayload(token, "mfa_ticket", secret, now);
    if (!payload || payload.action !== MFA_ACTION_TOTP_ENABLE || !payload.session_id) return undefined;
    return payload;
}

function verifyMfaPayload(token: string | undefined, expectedPrefix: "mfa", secret: string, now?: number): RecentMfaTokenPayload | undefined;
function verifyMfaPayload(token: string | undefined, expectedPrefix: "mfa_ticket", secret: string, now?: number): MfaTicketPayload | undefined;
function verifyMfaPayload(token: string | undefined, expectedPrefix: MfaTokenPrefix, secret: string, now = Date.now()): RecentMfaTokenPayload | MfaTicketPayload | undefined {
    if (!token) return undefined;

    const parts = token.split(".");
    if (parts.length !== 3) return undefined;

    const [prefix, encodedPayload, signature] = parts;
    if (prefix !== expectedPrefix || !encodedPayload || !signature) return undefined;

    const signedData = `${prefix}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(signedData).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return undefined;

    let payload: RecentMfaTokenPayload | MfaTicketPayload;
    try {
        payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as MfaTicketPayload;
    } catch {
        return undefined;
    }

    if (!isMfaPayload(payload, expectedPrefix)) return undefined;
    if (payload.exp < Math.floor(now / 1000)) return undefined;
    return payload;
}

function isMfaPayload(payload: RecentMfaTokenPayload | MfaTicketPayload, expectedPrefix: MfaTokenPrefix): boolean {
    return (
        payload &&
        payload.token_type === expectedPrefix &&
        (payload.action as string) === MFA_ACTION_TOTP_ENABLE &&
        typeof payload.user_id === "string" &&
        typeof payload.iat === "number" &&
        typeof payload.exp === "number" &&
        typeof payload.nonce === "string" &&
        (payload.session_id === undefined || typeof payload.session_id === "string")
    );
}

async function getRecentMfaSecret(): Promise<string> {
    const { loadOrGenerateKeypair } = await import("../../../util/index.js");
    const keyPair = await loadOrGenerateKeypair();
    return keyPair.privateKey.export({ format: "pem", type: "sec1" }).toString();
}

export async function generateRecentMfaToken(context: MfaTokenContext): Promise<string> {
    return signRecentMfaToken(context, await getRecentMfaSecret());
}

export async function generateMfaTicket(context: MfaTokenContext): Promise<string> {
    return signMfaTicket(context, await getRecentMfaSecret());
}

export async function hasRecentMfaToken(headers: { [key: string]: string | string[] | undefined }, context: MfaTokenContext): Promise<boolean> {
    return verifyRecentMfaToken(getRecentMfaToken(headers), context, await getRecentMfaSecret());
}

export async function verifyMfaTicketFromRequest(ticket: string): Promise<MfaTicketPayload | undefined> {
    return verifyMfaTicket(ticket, await getRecentMfaSecret());
}

export async function verifyTotpOrBackupCode(userId: string, totpSecret: string | null | undefined, code: string): Promise<boolean> {
    if (await consumeMfaBackupCode({ code, userId })) return true;

    return isCurrentTotpCode(totpSecret, code);
}

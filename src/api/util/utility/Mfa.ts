import crypto from "node:crypto";
import { verifyToken } from "node-2fa";

export const RECENT_MFA_COOKIE = "__Secure-recent_mfa";
export const RECENT_MFA_HEADER = "x-discord-mfa-authorization";
export const RECENT_MFA_MAX_AGE_SECONDS = 5 * 60;
export const MFA_REQUIRED_CODE = 60003;

export interface MfaRequiredResponseBody {
    message: string;
    code: typeof MFA_REQUIRED_CODE;
    mfa: {
        ticket: string;
        methods: { type: "password" }[];
    };
}

interface RecentMfaTokenPayload {
    user_id: string;
    iat: number;
    exp: number;
    nonce: string;
}

export interface MfaTicketPayload extends RecentMfaTokenPayload {
    action: "totp_enable";
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

export function signRecentMfaToken(userId: string, secret: string, now = Date.now()): string {
    return signMfaPayload("mfa", createTimedMfaPayload(userId, now), secret);
}

export function signMfaTicket(userId: string, secret: string, now = Date.now()): string {
    return signMfaPayload("mfa_ticket", { ...createTimedMfaPayload(userId, now), action: "totp_enable" }, secret);
}

function createTimedMfaPayload(userId: string, now = Date.now()): RecentMfaTokenPayload {
    return {
        user_id: userId,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + RECENT_MFA_MAX_AGE_SECONDS,
        nonce: crypto.randomBytes(16).toString("base64url"),
    };
}

function signMfaPayload(prefix: "mfa" | "mfa_ticket", payload: RecentMfaTokenPayload | MfaTicketPayload, secret: string): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

    return `${prefix}.${encodedPayload}.${signature}`;
}

export function verifyRecentMfaToken(token: string | undefined, userId: string, secret: string, now = Date.now()): boolean {
    const payload = verifyMfaPayload(token, "mfa", secret, now);
    return payload?.user_id === userId;
}

export function verifyMfaTicket(token: string | undefined, secret: string, now = Date.now()): MfaTicketPayload | undefined {
    const payload = verifyMfaPayload(token, "mfa_ticket", secret, now);
    if (!payload || !("action" in payload) || payload.action !== "totp_enable") return undefined;
    return payload;
}

function verifyMfaPayload(token: string | undefined, expectedPrefix: "mfa" | "mfa_ticket", secret: string, now = Date.now()): RecentMfaTokenPayload | MfaTicketPayload | undefined {
    if (!token) return undefined;

    const [prefix, encodedPayload, signature] = token.split(".");
    if (prefix !== expectedPrefix || !encodedPayload || !signature) return undefined;

    const expectedSignature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return undefined;

    let payload: RecentMfaTokenPayload | MfaTicketPayload;
    try {
        payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as MfaTicketPayload;
    } catch {
        return undefined;
    }

    if (payload.exp < Math.floor(now / 1000)) return undefined;
    return payload;
}

async function getRecentMfaSecret(): Promise<string> {
    const { loadOrGenerateKeypair } = await import("../../../util/index.js");
    const keyPair = await loadOrGenerateKeypair();
    return keyPair.privateKey.export({ format: "pem", type: "sec1" }).toString();
}

export async function generateRecentMfaToken(userId: string): Promise<string> {
    return signRecentMfaToken(userId, await getRecentMfaSecret());
}

export async function generateMfaTicket(userId: string): Promise<string> {
    return signMfaTicket(userId, await getRecentMfaSecret());
}

export async function hasRecentMfaToken(headers: { [key: string]: string | string[] | undefined }, userId: string): Promise<boolean> {
    return verifyRecentMfaToken(getRecentMfaToken(headers), userId, await getRecentMfaSecret());
}

export async function verifyMfaTicketFromRequest(ticket: string): Promise<MfaTicketPayload | undefined> {
    return verifyMfaTicket(ticket, await getRecentMfaSecret());
}

export async function verifyTotpOrBackupCode(userId: string, totpSecret: string | null | undefined, code: string): Promise<boolean> {
    const { BackupCode } = await import("../../../util/index.js");
    const backup = await BackupCode.findOne({
        where: {
            code,
            expired: false,
            consumed: false,
            user: { id: userId },
        },
    });

    if (backup) {
        backup.consumed = true;
        await backup.save();
        return true;
    }

    return verifyToken(totpSecret || "", code)?.delta === 0;
}

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminApiError, adminApiBase, adminFetch, getAuthorizationHeader } from "./admin-api";
import type { AdminUser } from "./types";

export interface AdminWhoami {
    user: AdminUser;
    sessionId: string | null;
    operator: true;
}

export type AdminSessionFailureReason = "missing" | "expired" | "forbidden" | "unreachable";

export interface AdminSessionFailure {
    ok: false;
    reason: AdminSessionFailureReason;
    message: string;
}

export interface AdminSessionSuccess {
    ok: true;
    session: AdminWhoami;
}

export type AdminSessionResult = AdminSessionSuccess | AdminSessionFailure;

export function adminTokenCookieName() {
    return process.env.SPACEBAR_ADMIN_TOKEN_COOKIE ?? "spacebar_admin_token";
}

export function adminLogoutCookieName() {
    return process.env.SPACEBAR_ADMIN_LOGOUT_COOKIE ?? "spacebar_admin_logged_out";
}

export function dashboardBasePath() {
    return (process.env.SPACEBAR_ADMIN_DASHBOARD_BASE_PATH ?? "/_spacebar/admin").replace(/\/+$/, "") || "/";
}

export function dashboardRoutePath(path: string) {
    const route = path.startsWith("/") ? path : `/${path}`;
    const basePath = dashboardBasePath();

    if (basePath !== "/" && (route === basePath || route.startsWith(`${basePath}/`))) return route;
    return basePath === "/" ? route : `${basePath}${route}`;
}

function firstForwardedHeaderValue(value: string | null) {
    return value?.split(",")[0]?.trim() || null;
}

export async function dashboardAbsoluteUrl(path: string) {
    const headerStore = await headers();
    const origin = headerStore.get("origin");
    if (origin?.startsWith("http://") || origin?.startsWith("https://")) {
        return new URL(dashboardRoutePath(path), origin).toString();
    }

    const host = firstForwardedHeaderValue(headerStore.get("x-forwarded-host")) ?? headerStore.get("host") ?? "localhost:3000";
    const protocol = firstForwardedHeaderValue(headerStore.get("x-forwarded-proto")) ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return new URL(dashboardRoutePath(path), `${protocol}://${host}`).toString();
}

function normalizeAuthorization(token: string) {
    const trimmed = token.trim();
    return trimmed.startsWith("Bearer ") || trimmed.startsWith("Bot ") ? trimmed : `Bearer ${trimmed}`;
}

export function adminSessionCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.SPACEBAR_ADMIN_COOKIE_SECURE ? process.env.SPACEBAR_ADMIN_COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production",
        path: dashboardBasePath(),
        maxAge: Number(process.env.SPACEBAR_ADMIN_SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 12),
    };
}

function mapAdminSessionError(error: unknown): AdminSessionFailure {
    if (error instanceof AdminApiError) {
        if (error.status === 401) {
            return { ok: false, reason: "expired", message: "The admin token is expired or invalid." };
        }
        if (error.status === 403) {
            return { ok: false, reason: "forbidden", message: "This token is valid, but OPERATOR rights are required." };
        }
        return { ok: false, reason: "unreachable", message: error.message };
    }

    return { ok: false, reason: "unreachable", message: error instanceof Error ? error.message : String(error) };
}

export async function validateAdminToken(token: string): Promise<AdminSessionResult> {
    const trimmed = token.trim();
    if (!trimmed) return { ok: false, reason: "missing", message: "Enter an admin token." };

    const timeout = Number(process.env.SPACEBAR_ADMIN_API_TIMEOUT_MS ?? 2500);

    try {
        const response = await fetch(`${adminApiBase()}/whoami`, {
            cache: "no-store",
            signal: AbortSignal.timeout(timeout),
            headers: {
                accept: "application/json",
                authorization: normalizeAuthorization(trimmed),
            },
        });

        if (!response.ok) {
            throw new AdminApiError(`${response.status} ${response.statusText}`, response.status);
        }

        return { ok: true, session: (await response.json()) as AdminWhoami };
    } catch (error) {
        return mapAdminSessionError(error);
    }
}

export async function setAdminSessionToken(token: string) {
    const cookieStore = await cookies();
    cookieStore.set(adminTokenCookieName(), token.trim(), adminSessionCookieOptions());
    cookieStore.set(adminLogoutCookieName(), "", {
        ...adminSessionCookieOptions(),
        maxAge: 0,
    });
}

export async function clearAdminSessionToken() {
    const cookieStore = await cookies();
    cookieStore.set(adminTokenCookieName(), "", {
        ...adminSessionCookieOptions(),
        maxAge: 0,
    });
    cookieStore.set(adminLogoutCookieName(), "1", adminSessionCookieOptions());
}

export async function getAdminSession(): Promise<AdminSessionResult> {
    const authorization = await getAuthorizationHeader();
    if (!authorization) return { ok: false, reason: "missing", message: "Missing admin token." };

    try {
        return { ok: true, session: await adminFetch<AdminWhoami>("/whoami") };
    } catch (error) {
        return mapAdminSessionError(error);
    }
}

export async function requireAdminSession() {
    const result = await getAdminSession();
    if (result.ok) return result.session;

    redirect(`/login?reason=${result.reason}`);
}

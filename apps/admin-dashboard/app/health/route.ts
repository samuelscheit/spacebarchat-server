import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function dashboardBasePath() {
    return (process.env.SPACEBAR_ADMIN_DASHBOARD_BASE_PATH ?? "/_spacebar/admin").replace(/\/+$/, "") || "/";
}

function adminApiSummary() {
    const raw = process.env.SPACEBAR_ADMIN_API_URL ?? "http://localhost:3001/_spacebar/admin/api";
    const timeoutMs = Number(process.env.SPACEBAR_ADMIN_API_TIMEOUT_MS ?? 2500);

    try {
        const url = new URL(raw);
        return {
            configured: Boolean(process.env.SPACEBAR_ADMIN_API_URL),
            path: url.pathname,
            timeoutMs,
        };
    } catch {
        return {
            configured: Boolean(process.env.SPACEBAR_ADMIN_API_URL),
            invalid: true,
            timeoutMs,
        };
    }
}

export function GET() {
    return NextResponse.json({
        ok: true,
        service: "spacebar-admin-dashboard",
        basePath: dashboardBasePath(),
        adminApi: adminApiSummary(),
        timestamp: new Date().toISOString(),
    });
}

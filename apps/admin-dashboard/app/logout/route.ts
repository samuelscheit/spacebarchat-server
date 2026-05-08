import { NextRequest, NextResponse } from "next/server";
import { adminLogoutCookieName, adminSessionCookieOptions, adminTokenCookieName, dashboardRoutePath } from "../lib/admin-session";

function logoutResponse(request: NextRequest) {
    const loginPath = dashboardRoutePath("/login?reason=logout");
    const response = NextResponse.redirect(new URL(loginPath, request.url));

    response.cookies.set(adminTokenCookieName(), "", {
        ...adminSessionCookieOptions(),
        maxAge: 0,
    });
    response.cookies.set(adminLogoutCookieName(), "1", adminSessionCookieOptions());

    return response;
}

export function GET(request: NextRequest) {
    return logoutResponse(request);
}

export function POST(request: NextRequest) {
    return logoutResponse(request);
}

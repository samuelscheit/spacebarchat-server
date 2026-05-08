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

export const NO_AUTHORIZATION_ROUTES = [
    // Authentication routes
    "POST /auth/login",
    "POST /auth/register",
    "GET /auth/location-metadata",
    "POST /auth/mfa/",
    /^POST \/mfa\/finish\/?$/,
    "POST /auth/verify",
    "POST /auth/forgot",
    "POST /auth/reset",
    "POST /auth/fingerprint",
    "GET /invites/",
    // Routes with a seperate auth system
    /^(POST|HEAD|GET|PATCH|DELETE) \/webhooks\/(?:\d+|\{webhook_id\})\/(?:[A-Za-z0-9_-]+|\{token\})(?:(?:\/messages\/(?:\d+|\{message_id\}))|\/github)?\/?$/, // no token requires auth
    /^POST \/interactions\/\d+\/[A-Za-z0-9_-]+\/callback/,
    // Public information endpoints
    "GET /ping",
    "GET /gateway",
    "GET /experiments",
    "GET /apex/experiments",
    "GET /updates",
    "GET /download",
    "GET /scheduled-maintenances/upcoming.json",
    // Public kubernetes integration
    "GET /-/readyz",
    "GET /-/healthz",
    // Client analytics
    "POST /science",
    "POST /track",
    // Public policy pages
    "GET /policies/instance/",
    "GET /policies/stats",
    // Oauth callback
    "/oauth2/callback",
    // Asset delivery
    /^(GET|HEAD) \/guilds\/\d+\/widget\.(json|png)/,
    /^(GET|HEAD) \/guilds\/\d+\/shield\.svg/,
    // Connections
    /^(POST|HEAD) \/connections\/\w+\/callback/,
    // Image proxy
    /^(GET|HEAD) \/imageproxy\/[A-Za-z0-9+/]\/\d+x\d+\/.+/,
];

export const API_PREFIX = /^\/api(\/v\d+)?/;
export const API_PREFIX_TRAILING_SLASH = /^\/api(\/v\d+)?\//;

function stripOptionalTrailingSlash(url: string): string {
    if (url.length <= 1) return url;
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function isNoAuthorizationRoute(method: string, rawUrl: string): boolean {
    const url = rawUrl.replace(API_PREFIX, "").split("?")[0];
    const exactUrl = stripOptionalTrailingSlash(url);

    return NO_AUTHORIZATION_ROUTES.some((x) => {
        if (typeof x !== "string") {
            return x.test(method + " " + url);
        }

        const fullRoute = method + " " + url;
        const exactFullRoute = method + " " + exactUrl;

        if (method === "HEAD") {
            const urlPart = x.split(" ").slice(1).join(" ");
            if (urlPart.endsWith("/")) {
                return url.startsWith(urlPart);
            }
            return exactUrl === urlPart;
        }

        if (x.endsWith("/")) {
            return fullRoute.startsWith(x);
        } else {
            return exactFullRoute === x;
        }
    });
}

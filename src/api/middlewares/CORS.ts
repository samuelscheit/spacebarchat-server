/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { NextFunction, Request, Response } from "express";
import { Config, type ConfigValue } from "@spacebar/util";

const CSP_DISABLED = "off";
const HTTP_ENDPOINT_PROTOCOLS = new Set(["http:", "https:"]);
const GATEWAY_ENDPOINT_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

const STATIC_ASSET_SOURCES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://raw.githubusercontent.com", "https://rawcdn.githack.com"];

const HCAPTCHA_SOURCES = ["https://hcaptcha.com", "https://*.hcaptcha.com"];
const RECAPTCHA_SCRIPT_SOURCES = ["https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"];
const RECAPTCHA_FRAME_SOURCES = ["https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"];
const RECAPTCHA_CONNECT_SOURCES = ["https://www.google.com/recaptcha/"];

function endpointOrigin(endpoint: string | null | undefined, allowedProtocols: ReadonlySet<string> = HTTP_ENDPOINT_PROTOCOLS) {
    if (!endpoint) return undefined;

    try {
        const url = new URL(endpoint);
        if (!allowedProtocols.has(url.protocol) || url.origin === "null") return undefined;
        return url.origin;
    } catch {
        return undefined;
    }
}

function dedupe(values: (string | undefined)[]) {
    return [...new Set(values.filter((value): value is string => !!value))];
}

type ContentSecurityPolicyOptions = {
    allowEmbedding?: boolean;
};

function directive(name: string, values: string[]) {
    return `${name} ${values.join(" ")}`;
}

function allowsExternalEmbedding(req: Request) {
    return req.path === "/widget" || req.path === "/widget/";
}

export function buildDefaultContentSecurityPolicy(config: ConfigValue = Config.get(), options: ContentSecurityPolicyOptions = {}) {
    const httpEndpointSources = dedupe([
        "'self'",
        endpointOrigin(config.admin.endpointPublic),
        endpointOrigin(config.api.endpointPublic),
        endpointOrigin(config.cdn.endpointPublic),
        ...STATIC_ASSET_SOURCES,
    ]);
    const connectSources = dedupe([
        "'self'",
        endpointOrigin(config.admin.endpointPublic),
        endpointOrigin(config.api.endpointPublic),
        endpointOrigin(config.cdn.endpointPublic),
        endpointOrigin(config.gateway.endpointPublic, GATEWAY_ENDPOINT_PROTOCOLS),
        ...HCAPTCHA_SOURCES,
        ...RECAPTCHA_CONNECT_SOURCES,
    ]);
    const frameSources = dedupe(["'self'", ...HCAPTCHA_SOURCES, ...RECAPTCHA_FRAME_SOURCES]);

    return [
        directive("default-src", ["'self'"]),
        directive("base-uri", ["'self'"]),
        directive("object-src", ["'none'"]),
        options.allowEmbedding ? undefined : directive("frame-ancestors", ["'self'"]),
        directive("form-action", ["'self'"]),
        directive("script-src", dedupe(["'self'", "'unsafe-inline'", ...HCAPTCHA_SOURCES, ...RECAPTCHA_SCRIPT_SOURCES])),
        directive("style-src", dedupe(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", ...HCAPTCHA_SOURCES])),
        directive("font-src", dedupe(["'self'", "data:", "https://fonts.gstatic.com"])),
        directive("img-src", dedupe([...httpEndpointSources, ...HCAPTCHA_SOURCES, "data:", "blob:"])),
        directive("connect-src", connectSources),
        directive("frame-src", frameSources),
        directive("worker-src", ["'self'", "blob:"]),
        directive("media-src", dedupe(["'self'", endpointOrigin(config.cdn.endpointPublic), "blob:"])),
        directive("manifest-src", ["'self'"]),
    ]
        .filter((value): value is string => !!value)
        .join("; ");
}

export function getConfiguredContentSecurityPolicy(config: ConfigValue = Config.get(), options: ContentSecurityPolicyOptions = {}) {
    const configuredPolicy = config.security.contentSecurityPolicy;
    if (typeof configuredPolicy === "string") {
        const trimmedPolicy = configuredPolicy.trim();
        if (trimmedPolicy.toLowerCase() === CSP_DISABLED) return undefined;
        if (trimmedPolicy) return trimmedPolicy;
    }

    return buildDefaultContentSecurityPolicy(config, options);
}

export function CORS(req: Request, res: Response, next: NextFunction) {
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "*");
    res.set("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method") || "*");
    res.set("Access-Control-Allow-Origin", req.header("Origin") ?? "*");
    res.set("Access-Control-Max-Age", "60"); // dont make it too long so we can change it dynamically

    const contentSecurityPolicy = getConfiguredContentSecurityPolicy(Config.get(), { allowEmbedding: allowsExternalEmbedding(req) });
    if (contentSecurityPolicy) res.set("Content-Security-Policy", contentSecurityPolicy);

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
}

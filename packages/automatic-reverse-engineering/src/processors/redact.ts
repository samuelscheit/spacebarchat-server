import { FixtureManifest } from "../fixtures/manifest.js";
import { normalizeJsonValue, normalizeString } from "./normalize.js";

const sensitiveHeaderNames = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-fingerprint",
    "x-super-properties",
    "x-context-properties",
    "x-debug-options",
    "x-discord-token",
    "x-session-id",
    "x-track",
    "referer",
    "referrer",
]);

const safeHeaderNames = new Set([
    "accept",
    "accept-language",
    "access-control-allow-origin",
    "cache-control",
    "content-encoding",
    "content-length",
    "content-type",
    "origin",
    "user-agent",
]);

const sensitiveKeyPattern =
    /(authorization|auth|cookie|token|secret|password|mfa|ticket|email|phone|session|fingerprint|super_properties|client_secret|access_token|refresh_token)/i;
const privateTextKeyPattern = /(content|username|global_name|name|nick|bio|pronouns|description|reason|filename|url|avatar|banner|icon)/i;

const discordTokenPatterns = [
    /mfa\.[a-z0-9_-]{20,}/i,
    /[a-z0-9_-]{23,28}\.[a-z0-9_-]{6,8}\.[a-z0-9_-]{27,}/i,
    /(authorization|set-cookie|cookie)\s*[:=]/i,
    /(access_token|refresh_token|client_secret)["'\s:=]+[a-z0-9_.-]{10,}/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?<![A-Fa-f0-9.])\d{17,20}(?![A-Fa-f0-9.])/,
];

export interface RedactionOptions {
    fixtures?: FixtureManifest;
    preserveHeaderAllowlist?: boolean;
}

export interface SecretScanResult {
    ok: boolean;
    violations: string[];
}

export function redactHeaders(headers: Record<string, string | string[] | undefined>, options: RedactionOptions = {}): Record<string, string | string[]> {
    const output: Record<string, string | string[]> = {};
    for (const [name, value] of Object.entries(headers)) {
        const normalizedName = name.toLowerCase();
        if (typeof value === "undefined") {
            continue;
        }

        if (sensitiveHeaderNames.has(normalizedName)) {
            output[name] = "{redacted}";
            continue;
        }

        if (options.preserveHeaderAllowlist === false || safeHeaderNames.has(normalizedName)) {
            output[name] = Array.isArray(value) ? value.map((entry) => normalizeString(entry, options.fixtures)) : normalizeString(value, options.fixtures);
        } else {
            output[name] = "{redacted-header}";
        }
    }

    return output;
}

export function redactJsonValue(value: unknown, options: RedactionOptions = {}): unknown {
    const normalized = normalizeJsonValue(value, options.fixtures);
    return redactNormalizedValue(normalized);
}

export function redactText(text: string, options: RedactionOptions = {}): string {
    return normalizeString(text, options.fixtures)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "{email}")
        .replace(/\+?\d[\d\s().-]{7,}\d/g, "{phone}")
        .replace(/mfa\.[a-z0-9_-]{20,}/gi, "{token}")
        .replace(/[a-z0-9_-]{23,28}\.[a-z0-9_-]{6,8}\.[a-z0-9_-]{27,}/gi, "{token}");
}

export function scanForSecrets(value: unknown): SecretScanResult {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const violations = discordTokenPatterns.filter((pattern) => pattern.test(serialized)).map((pattern) => pattern.source);

    return {
        ok: violations.length === 0,
        violations,
    };
}

function redactNormalizedValue(value: unknown): unknown {
    if (typeof value === "string") {
        return redactText(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactNormalizedValue(item));
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        if (sensitiveKeyPattern.test(key)) {
            output[key] = "{redacted}";
        } else if (privateTextKeyPattern.test(key) && typeof child === "string") {
            output[key] = "{redacted_string}";
        } else {
            output[key] = redactNormalizedValue(child);
        }
    }

    return output;
}

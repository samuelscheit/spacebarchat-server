import { FixtureManifest, flattenFixtureIds } from "../fixtures/manifest.js";

const snowflakePattern = /^\d{17,20}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestampLikePattern = /^\d{10,13}$/;
const embeddedSnowflakePattern = /(?<![A-Fa-f0-9.])\d{17,20}(?![A-Fa-f0-9.])/g;

export interface NormalizedUrl {
    normalized_url: string;
    normalized_route: string;
    api_version?: string;
    query_keys: string[];
}

export interface NormalizationOptions {
    apiHosts?: readonly string[];
    fixtures?: FixtureManifest;
}

const defaultApiHosts = ["discord.com", "canary.discord.com", "ptb.discord.com"];

export function normalizeUrl(input: string, options: NormalizationOptions = {}): NormalizedUrl {
    const url = parseUrl(input);
    const queryKeys = Array.from(url.searchParams.keys()).sort();
    const pathParts = url.pathname.split("/").filter(Boolean);
    const { apiVersion, routeParts } = stripApiPrefix(pathParts);
    const normalizedParts = routeParts.map((part, index) => normalizePathPart(part, routeParts[index - 1], options.fixtures));
    const normalizedRoute = `/${normalizedParts.join("/")}`;
    const host = isApiHost(url.hostname, options.apiHosts ?? defaultApiHosts) ? "{api_host}" : url.hostname;
    const apiPrefix = apiVersion ? `/api/${apiVersion}` : "";
    const querySuffix = queryKeys.length > 0 ? `?${queryKeys.map((key) => `${key}={query}`).join("&")}` : "";

    return {
        normalized_url: `${url.protocol}//${host}${apiPrefix}${normalizedRoute}${querySuffix}`,
        normalized_route: normalizedRoute,
        api_version: apiVersion,
        query_keys: queryKeys,
    };
}

export function normalizeRoutePattern(input: string, options: NormalizationOptions = {}): string {
    const prefixedInput = input.startsWith("http") ? input : `https://discord.com${input}`;
    return normalizeUrl(prefixedInput, options).normalized_route;
}

export function normalizeJsonValue(value: unknown, fixtures?: FixtureManifest): unknown {
    if (typeof value === "string") {
        return normalizeString(value, fixtures);
    }

    if (typeof value === "number") {
        return normalizeNumber(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeJsonValue(item, fixtures));
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        output[uniqueNormalizedKey(output, normalizeString(key, fixtures))] = normalizeJsonValue(child, fixtures);
    }

    return output;
}

export function normalizeString(value: string, fixtures?: FixtureManifest): string {
    const fixture = flattenFixtureIds(fixtures).get(value);
    if (fixture) {
        return fixture.placeholder;
    }

    if (snowflakePattern.test(value)) {
        return "{snowflake}";
    }

    if (uuidPattern.test(value)) {
        return "{uuid}";
    }

    if (timestampLikePattern.test(value)) {
        return "{timestamp}";
    }

    return value.replace(embeddedSnowflakePattern, "{snowflake}").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "{uuid}");
}

function normalizeNumber(value: number): number | string {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        return value;
    }

    const asString = String(value);
    if (snowflakePattern.test(asString) || (value >= 1e16 && value < 1e20)) {
        return "{snowflake}";
    }

    if (timestampLikePattern.test(asString)) {
        return "{timestamp}";
    }

    return value;
}

function uniqueNormalizedKey(output: Record<string, unknown>, key: string): string {
    if (!Object.prototype.hasOwnProperty.call(output, key)) {
        return key;
    }

    let suffix = 2;
    let candidate = `${key}#${suffix}`;
    while (Object.prototype.hasOwnProperty.call(output, candidate)) {
        suffix += 1;
        candidate = `${key}#${suffix}`;
    }

    return candidate;
}

function parseUrl(input: string): URL {
    try {
        return new URL(input);
    } catch {
        return new URL(input, "https://discord.com");
    }
}

function stripApiPrefix(parts: string[]): { apiVersion?: string; routeParts: string[] } {
    if (parts[0] === "api" && /^v\d+$/.test(parts[1] ?? "")) {
        return { apiVersion: parts[1], routeParts: parts.slice(2) };
    }

    return { routeParts: parts };
}

function normalizePathPart(part: string, previousPart: string | undefined, fixtures?: FixtureManifest): string {
    const decoded = safeDecode(part);
    if (previousPart === "reactions") {
        return "{emoji}";
    }

    const fixture = flattenFixtureIds(fixtures).get(decoded);
    if (fixture) {
        return fixture.placeholder;
    }

    if (snowflakePattern.test(decoded)) {
        return placeholderForPreviousPart(previousPart);
    }

    if (uuidPattern.test(decoded)) {
        return "{uuid}";
    }

    return decoded;
}

function placeholderForPreviousPart(previousPart: string | undefined): string {
    switch (previousPart) {
        case "channels":
            return "{channel_id}";
        case "guilds":
            return "{guild_id}";
        case "messages":
            return "{message_id}";
        case "users":
            return "{user_id}";
        case "roles":
            return "{role_id}";
        case "applications":
        case "oauth2":
            return "{application_id}";
        case "webhooks":
            return "{webhook_id}";
        case "emojis":
            return "{emoji_id}";
        case "stickers":
            return "{sticker_id}";
        default:
            return "{snowflake}";
    }
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function isApiHost(host: string, apiHosts: readonly string[]): boolean {
    return apiHosts.includes(host);
}

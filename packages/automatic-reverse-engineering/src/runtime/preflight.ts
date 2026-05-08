import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
    FixtureManifest,
    FixtureValidationResult,
    DisposableFixtureValidationResult,
    redactFixtureManifest,
    validateDisposableFixtures,
    validateRequiredFixtures,
} from "../fixtures/manifest.js";
import { isRecord } from "../util/json.js";

export interface RuntimePreflightOptions {
    storageStatePath: string;
    fixtures?: FixtureManifest;
    requiredFixtures?: readonly string[];
    requiredDisposableFixtures?: readonly string[];
    forbiddenStorageRoots?: readonly string[];
    maxStorageStateAgeMs?: number;
    storageStateCreatedAtMs?: number;
    nowMs?: number;
}

export interface RuntimePreflightReport {
    ok: boolean;
    violations: string[];
    storage_state: StorageStateSummary;
    fixtures?: {
        redacted_manifest: FixtureManifest;
        validation: FixtureValidationResult;
        disposable_validation: DisposableFixtureValidationResult;
    };
}

export interface StorageStateSummary {
    path: string;
    cookie_count: number;
    origin_count: number;
    discord_cookie_count: number;
    discord_origin_count: number;
    discord_auth_cookie_count: number;
    discord_expired_auth_cookie_count: number;
    discord_auth_storage_count: number;
    has_discord_session: boolean;
    storage_state_age_ms?: number;
    max_storage_state_age_ms: number;
    storage_state_age_source: "provided_created_at" | "file_mtime" | "unavailable";
    storage_state_fresh: boolean;
    earliest_cookie_expiry?: number;
    latest_cookie_expiry?: number;
    forbidden_storage_root?: string;
    parse_error?: string;
}

const redactedStorageStatePath = "{storage_state_path}";
const redactedForbiddenStorageRoot = "{forbidden_storage_root}";
const defaultMaxStorageStateAgeMs = 7 * 24 * 60 * 60 * 1000;

export async function validateRuntimePreflight(options: RuntimePreflightOptions): Promise<RuntimePreflightReport> {
    const violations: string[] = [];
    const forbiddenStorageRoot = forbiddenRootForPath(options.storageStatePath, options.forbiddenStorageRoots ?? []);
    const nowMs = options.nowMs ?? Date.now();
    const maxStorageStateAgeMs = options.maxStorageStateAgeMs ?? defaultMaxStorageStateAgeMs;
    let storageState: unknown;
    let parseError: string | undefined;
    let storageStateAgeMs: number | undefined;
    let storageStateAgeSource: StorageStateSummary["storage_state_age_source"] = "unavailable";
    let storageStateTimestampInFuture = false;

    try {
        storageState = JSON.parse(await readFile(options.storageStatePath, "utf8")) as unknown;
    } catch (error) {
        parseError = errorCodeForReport(error);
        violations.push("storage_state_unreadable");
    }

    if (typeof options.storageStateCreatedAtMs === "number") {
        const rawAgeMs = nowMs - options.storageStateCreatedAtMs;
        storageStateTimestampInFuture = rawAgeMs < 0;
        storageStateAgeMs = Math.max(0, Math.floor(rawAgeMs));
        storageStateAgeSource = "provided_created_at";
    } else {
        try {
            const storageStat = await stat(options.storageStatePath);
            storageStateAgeMs = Math.max(0, Math.floor(nowMs - storageStat.mtimeMs));
            storageStateAgeSource = "file_mtime";
        } catch {
            if (!parseError) {
                violations.push("storage_state_stat_unavailable");
            }
        }
    }

    const storageSummary = summarizeStorageState(
        storageState,
        Boolean(forbiddenStorageRoot),
        maxStorageStateAgeMs,
        storageStateAgeSource,
        storageStateTimestampInFuture,
        storageStateAgeMs,
        parseError,
    );
    if (forbiddenStorageRoot) {
        violations.push("storage_state_in_artifact_root");
    }
    if (!parseError && storageSummary.cookie_count === 0 && storageSummary.origin_count === 0) {
        violations.push("storage_state_empty");
    }
    if (!parseError && !storageSummary.has_discord_session) {
        violations.push("storage_state_missing_discord_session");
    }
    if (!parseError && !storageSummary.storage_state_fresh) {
        violations.push("storage_state_stale");
    }
    if (!parseError && storageStateTimestampInFuture) {
        violations.push("storage_state_created_at_in_future");
    }
    if (!parseError && storageSummary.discord_expired_auth_cookie_count > 0) {
        violations.push("storage_state_expired_discord_auth_cookie");
    }

    const requiredFixtures = options.requiredFixtures ?? [];
    const requiredDisposableFixtures = options.requiredDisposableFixtures ?? [];
    const shouldValidateFixtures = Boolean(options.fixtures) || requiredFixtures.length > 0 || requiredDisposableFixtures.length > 0;
    const fixtureManifest = options.fixtures ?? {};
    const fixtureValidation = shouldValidateFixtures ? validateRequiredFixtures(fixtureManifest, requiredFixtures) : undefined;
    const disposableValidation = shouldValidateFixtures ? validateDisposableFixtures(fixtureManifest, requiredDisposableFixtures) : undefined;
    if (fixtureValidation && !fixtureValidation.ok) {
        violations.push(...fixtureValidation.missing.map((fixture) => `missing_fixture:${fixture}`));
    }
    if (disposableValidation && !disposableValidation.ok) {
        violations.push(...disposableValidation.missing.map((fixture) => `missing_disposable_fixture:${fixture}`));
        violations.push(...disposableValidation.not_disposable.map((fixture) => `fixture_not_disposable:${fixture}`));
    }

    return {
        ok: violations.length === 0,
        violations,
        storage_state: storageSummary,
        fixtures:
            shouldValidateFixtures && fixtureValidation && disposableValidation
                ? {
                      redacted_manifest: redactFixtureManifest(fixtureManifest),
                      validation: fixtureValidation,
                      disposable_validation: disposableValidation,
                  }
                : undefined,
    };
}

function summarizeStorageState(
    storageState: unknown,
    forbiddenStorageRoot: boolean,
    maxStorageStateAgeMs: number,
    storageStateAgeSource: StorageStateSummary["storage_state_age_source"],
    storageStateTimestampInFuture: boolean,
    storageStateAgeMs?: number,
    parseError?: string,
): StorageStateSummary {
    const storageStateFresh = !storageStateTimestampInFuture && typeof storageStateAgeMs === "number" && storageStateAgeMs <= maxStorageStateAgeMs;
    if (!isRecord(storageState)) {
        return {
            path: redactedStorageStatePath,
            cookie_count: 0,
            origin_count: 0,
            discord_cookie_count: 0,
            discord_origin_count: 0,
            discord_auth_cookie_count: 0,
            discord_expired_auth_cookie_count: 0,
            discord_auth_storage_count: 0,
            has_discord_session: false,
            storage_state_age_ms: storageStateAgeMs,
            max_storage_state_age_ms: maxStorageStateAgeMs,
            storage_state_age_source: storageStateAgeSource,
            storage_state_fresh: storageStateFresh,
            forbidden_storage_root: forbiddenStorageRoot ? redactedForbiddenStorageRoot : undefined,
            parse_error: parseError,
        };
    }

    const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : [];
    const origins = Array.isArray(storageState.origins) ? storageState.origins : [];
    const cookieExpiries = cookies
        .map((cookie) => (isRecord(cookie) && typeof cookie.expires === "number" ? cookie.expires : undefined))
        .filter((expiry): expiry is number => typeof expiry === "number" && expiry > 0);
    const discordCookieCount = cookies.filter((cookie) => isRecord(cookie) && isDiscordHost(String(cookie.domain ?? ""))).length;
    const discordOriginCount = origins.filter((origin) => isRecord(origin) && isDiscordOrigin(String(origin.origin ?? ""))).length;
    const discordAuthCookies = cookies.filter(isDiscordAuthCookie);
    const discordAuthCookieCount = cookies.filter(isActiveDiscordAuthCookie).length;
    const discordExpiredAuthCookieCount = discordAuthCookies.filter((cookie) => !isActiveCookie(cookie)).length;
    const discordAuthStorageCount = origins.filter(isDiscordOriginWithAuthStorage).length;

    return {
        path: redactedStorageStatePath,
        cookie_count: cookies.length,
        origin_count: origins.length,
        discord_cookie_count: discordCookieCount,
        discord_origin_count: discordOriginCount,
        discord_auth_cookie_count: discordAuthCookieCount,
        discord_expired_auth_cookie_count: discordExpiredAuthCookieCount,
        discord_auth_storage_count: discordAuthStorageCount,
        has_discord_session: discordAuthCookieCount > 0 || discordAuthStorageCount > 0,
        storage_state_age_ms: storageStateAgeMs,
        max_storage_state_age_ms: maxStorageStateAgeMs,
        storage_state_age_source: storageStateAgeSource,
        storage_state_fresh: storageStateFresh,
        earliest_cookie_expiry: cookieExpiries.length > 0 ? Math.min(...cookieExpiries) : undefined,
        latest_cookie_expiry: cookieExpiries.length > 0 ? Math.max(...cookieExpiries) : undefined,
        forbidden_storage_root: forbiddenStorageRoot ? redactedForbiddenStorageRoot : undefined,
        parse_error: parseError,
    };
}

function errorCodeForReport(error: unknown): string {
    const nodeError = error as NodeJS.ErrnoException;
    if (typeof nodeError.code === "string") {
        return nodeError.code;
    }
    return error instanceof Error && error.name ? error.name : "Error";
}

function forbiddenRootForPath(filePath: string, roots: readonly string[]): string | undefined {
    const resolved = path.resolve(filePath);
    return roots.find((root) => isInsidePath(resolved, path.resolve(root)));
}

function isInsidePath(filePath: string, root: string): boolean {
    const relative = path.relative(root, filePath);
    return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function isDiscordOrigin(origin: string): boolean {
    try {
        return isDiscordHost(new URL(origin).hostname);
    } catch {
        return false;
    }
}

function isDiscordOriginWithAuthStorage(origin: unknown): boolean {
    if (!isRecord(origin) || !isDiscordOrigin(String(origin.origin ?? "")) || !Array.isArray(origin.localStorage)) {
        return false;
    }

    return origin.localStorage.some((entry) => {
        if (!isRecord(entry) || typeof entry.name !== "string" || typeof entry.value !== "string") {
            return false;
        }

        return isAuthStorageName(entry.name) && hasUsableStorageValue(entry.value);
    });
}

function isActiveDiscordAuthCookie(cookie: unknown): boolean {
    return isDiscordAuthCookie(cookie) && isActiveCookie(cookie);
}

function isDiscordAuthCookie(cookie: unknown): cookie is Record<string, unknown> {
    if (!isRecord(cookie) || !isDiscordHost(String(cookie.domain ?? "")) || typeof cookie.name !== "string") {
        return false;
    }

    return isAuthStorageName(cookie.name);
}

function isAuthStorageName(name: string): boolean {
    return /^(token|authorization|auth|session)$/i.test(name) || /(auth|session|token)/i.test(name);
}

function hasUsableStorageValue(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== '""' && !/^null$/i.test(trimmed) && !/^undefined$/i.test(trimmed);
}

function isActiveCookie(cookie: Record<string, unknown>): boolean {
    if (typeof cookie.expires !== "number") {
        return true;
    }

    return cookie.expires < 0 || cookie.expires > Date.now() / 1000;
}

function isDiscordHost(host: string): boolean {
    const normalized = host.replace(/^\./, "").toLowerCase();
    return normalized === "discord.com" || normalized.endsWith(".discord.com") || normalized === "discordapp.com" || normalized.endsWith(".discordapp.com");
}

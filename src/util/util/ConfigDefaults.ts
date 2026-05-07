import { ApiConfiguration } from "../config/types/ApiConfiguration";
import { normalizeApiActiveVersions } from "./ApiVersions";

interface ConfigWithApi {
    api?: ApiConfiguration | null;
}

export function normalizeConfig<T extends ConfigWithApi>(value: T): T & { api: ApiConfiguration } {
    if (!value.api) value.api = new ApiConfiguration();
    value.api.activeVersions = normalizeApiActiveVersions(value.api.activeVersions);
    return value as T & { api: ApiConfiguration };
}

export function mergeConfigDefaults<T>(defaults: T, override: unknown): T {
    if (override === undefined) return defaults;

    if (Array.isArray(defaults) || Array.isArray(override)) {
        return (Array.isArray(override) ? [...override] : override) as T;
    }

    if (isRecord(defaults) && isRecord(override)) {
        const target = defaults as Record<string, unknown>;
        for (const key of Object.keys(override)) {
            target[key] = mergeConfigDefaults(target[key], override[key]);
        }

        return defaults as T;
    }

    return override as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

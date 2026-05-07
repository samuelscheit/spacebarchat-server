export const API_VERSIONS = ["3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const API_VERSION_PREFIXES = API_VERSIONS.map((version) => `/api/v${version}`);
export const API_PREFIXES = [...API_VERSION_PREFIXES, "/api"];

const LEGACY_DEFAULT_API_VERSIONS = ["6", "7", "8", "9"] as const;
const LEGACY_MERGED_DEFAULT_API_VERSIONS = ["6", "7", "8", "9", "7", "8", "9", "10"] as const;

export function normalizeApiActiveVersions(activeVersions: unknown): string[] {
    if (!Array.isArray(activeVersions)) {
        return [...API_VERSIONS];
    }

    if (versionListEquals(activeVersions, LEGACY_DEFAULT_API_VERSIONS) || versionListEquals(activeVersions, LEGACY_MERGED_DEFAULT_API_VERSIONS)) {
        return [...API_VERSIONS];
    }

    return [...new Set(activeVersions.filter((version): version is string => typeof version === "string"))];
}

function versionListEquals(versions: readonly unknown[], expected: readonly string[]) {
    return versions.length === expected.length && expected.every((version, index) => versions[index] === version);
}

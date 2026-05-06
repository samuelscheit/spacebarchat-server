export const API_VERSIONS = ["3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const API_VERSION_PREFIXES = API_VERSIONS.map((version) => `/api/v${version}`);
export const API_PREFIXES = [...API_VERSION_PREFIXES, "/api"];

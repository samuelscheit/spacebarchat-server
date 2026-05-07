import fs from "node:fs/promises";

type JsonLike = Record<string, unknown>;

const ENV_PREFIX = "SPACEBAR_CONFIG__";
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const normalizeKey = (key: string) => key.replace(/_/g, "").toLowerCase();

const findObjectKey = (obj: JsonLike, requestedKey: string) => {
    const normalized = normalizeKey(requestedKey);
    return Object.keys(obj).find((key) => normalizeKey(key) === normalized);
};

const parseEnvValue = (value: string) => {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return value;
    }
};

const resolvePath = (config: JsonLike, name: string, rawPath: string[]) => {
    if (!rawPath.length) throw new Error(`[Config] Invalid environment override path: ${name}`);

    const path = [...rawPath];
    let obj: JsonLike = config;
    for (const segment of path.slice(0, -1)) {
        if (FORBIDDEN_KEYS.has(segment)) throw new Error(`[Config] Refusing unsafe environment override path: ${name}`);

        const key = findObjectKey(obj, segment);
        if (!key || obj[key] == null || typeof obj[key] !== "object" || Array.isArray(obj[key])) throw new Error(`[Config] Unknown environment override path: ${name}`);
        obj = obj[key] as JsonLike;
    }

    const leaf = path[path.length - 1];
    if (FORBIDDEN_KEYS.has(leaf)) throw new Error(`[Config] Refusing unsafe environment override path: ${name}`);

    const key = findObjectKey(obj, leaf);
    if (!key) throw new Error(`[Config] Unknown environment override path: ${name}`);

    return { obj, key, path };
};

export const applyEnvConfigOverrides = async <T extends JsonLike>(config: T, env: NodeJS.ProcessEnv = process.env, prefix = ENV_PREFIX): Promise<T> => {
    const overrides = Object.entries(env)
        .filter(([name, value]) => name.startsWith(prefix) && value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));

    for (const [name, value] of overrides) {
        const rawPath = name.slice(prefix.length).split("__").filter(Boolean);
        const leaf = rawPath[rawPath.length - 1];
        const isPathOverride = leaf?.endsWith("_PATH");
        if (isPathOverride) {
            rawPath[rawPath.length - 1] = leaf.slice(0, -"_PATH".length);
            if (!rawPath[rawPath.length - 1]) throw new Error(`[Config] Invalid environment override path: ${name}`);
        }

        const { obj, key } = resolvePath(config, name, rawPath);
        obj[key] = isPathOverride ? (await fs.readFile(value as string, "utf8")).trim() : parseEnvValue(value as string);
    }

    return config;
};

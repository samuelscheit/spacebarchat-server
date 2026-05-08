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

import fs from "node:fs/promises";
import {
    DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS,
    DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT,
    GATEWAY_HEARTBEAT_INTERVAL,
    ConfigValue,
    isValidGatewayDisconnectedSessionCleanupDelay,
    isValidGatewayHeartbeatTimeout,
} from "../config";
import { ConfigEntity } from "../entities";
import { JsonValue } from "@protobuf-ts/runtime";
import { bold, red, redBright } from "picocolors";
import { mergeConfigDefaults, normalizeConfig } from "./ConfigDefaults";
import { applyEnvConfigOverrides } from "./EnvConfig";
import { readJsonConfigFile } from "./JsonConfigFile";

// TODO: yaml instead of json
let config: ConfigValue;
let pairs: ConfigEntity[];

// TODO: use events to inform about config updates
// Config keys are separated with _

export class Config {
    public static async init(force: boolean = false) {
        if (config && !force) return config;
        console.log("[Config] Loading configuration...");
        if (!process.env.CONFIG_PATH) {
            if (process.env.CONFIG_SOURCE !== "database") {
                console.log("[Config]:", redBright("Warning:"), bold("Database driven configuration has been deprecated"));
                console.log("[Config]:", redBright("Warning:"), "Please migrate to JSON configuration by setting CONFIG_PATH=/path/to/config.json");
                console.log("[Config]:", redBright("Warning:"), "  or set CONFIG_SOURCE=database to ignore this warning for now.");
                console.log("[Config]:", redBright("Warning:"), "");
                console.log("[Config]:", redBright("Warning:"), "Note that this option will be removed soon, and lack hereof will stop the server from starting!");
            }

            pairs = await validateConfig();
            config = pairsToConfig(pairs);
        } else {
            console.log(`[Config] Using CONFIG_PATH rather than database:`, process.env.CONFIG_PATH);
            config = (await readJsonConfigFile(process.env.CONFIG_PATH)) as Partial<ConfigValue> as ConfigValue;
            pairs = generatePairs(config);
        }

        // If a config doesn't exist, create it.
        if (Object.keys(config).length == 0) config = new ConfigValue();

        config = normalizeConfig(mergeConfigDefaults(new ConfigValue(), config));

        // TODO: factor this out someday
        if (process.env.CDN_SIGNATURE_PATH) config.security.cdnSignatureKey = await Config.readSecret("CDN_SIGNATURE_PATH");
        if (process.env.LEGACY_JWT_SECRET_PATH) config.security.jwtSecret = await Config.readSecret("LEGACY_JWT_SECRET_PATH");
        if (process.env.MAILJET_API_KEY_PATH) config.email.mailjet.apiKey = await Config.readSecret("MAILJET_API_KEY_PATH");
        if (process.env.MAILJET_API_SECRET_PATH) config.email.mailjet.apiSecret = await Config.readSecret("MAILJET_API_SECRET_PATH");
        if (process.env.SMTP_PASSWORD_PATH) config.email.smtp.password = await Config.readSecret("SMTP_PASSWORD_PATH");
        if (process.env.GIF_API_KEY_PATH) config.gif.apiKey = await Config.readSecret("GIF_API_KEY_PATH");
        if (process.env.DISCORD_ATTACHMENT_REFRESH_BOT_TOKEN_PATH)
            config.external.discordAttachmentRefreshBotToken = await Config.readSecret("DISCORD_ATTACHMENT_REFRESH_BOT_TOKEN_PATH");
        if (process.env.RABBITMQ_HOST) config.rabbitmq.host = process.env.RABBITMQ_HOST.trim();
        if (process.env.RABBITMQ_HOST_PATH) config.rabbitmq.host = await Config.readSecret("RABBITMQ_HOST_PATH");
        if (process.env.ABUSEIPDB_API_KEY_PATH) config.security.abuseIpDbApiKey = await Config.readSecret("ABUSEIPDB_API_KEY_PATH");
        if (process.env.CAPTCHA_SECRET_KEY_PATH) config.security.captcha.secret = await Config.readSecret("CAPTCHA_SECRET_KEY_PATH");
        if (process.env.CAPTCHA_SITE_KEY_PATH) config.security.captcha.sitekey = await Config.readSecret("CAPTCHA_SITE_KEY_PATH");
        if (process.env.IPDATA_API_KEY_PATH) config.security.ipdataApiKey = await Config.readSecret("IPDATA_API_KEY_PATH");
        if (process.env.REQUEST_SIGNATURE_PATH) config.security.requestSignature = await Config.readSecret("REQUEST_SIGNATURE_PATH");

        await this.set(config);
        await applyEnvConfigOverrides(config as unknown as Record<string, unknown>);
        validateFinalConfig(config);
        return config;
    }

    private static async readSecret(name: string) {
        process.stdout.write(`[Config] Reading secret ${name}...`);
        const res = (await fs.readFile(process.env[name]!, "utf-8")).trim();
        if (process.env.LOG_SECRET_VALUES) process.stdout.write(" " + res);
        else process.stdout.write(" Done!");
        process.stdout.write("\n");
        return res;
    }
    public static get() {
        if (!config) {
            // If we haven't initialised the config yet, return default config.
            // Typeorm instantiates each entity once when initialising database,
            // which means when we use config values as default values in entity classes,
            // the config isn't initialised yet and would throw an error about the config being undefined.

            return new ConfigValue();
        }

        return config;
    }
    public static set(val: Partial<ConfigValue>) {
        if (!config || !val) return;
        config = mergeConfig(config, val);

        return applyConfig(config);
    }
}

type PersistedConfigValue = Exclude<ConfigEntity["value"], undefined>;
type ConfigRecord = Record<string, unknown>;
type ConfigBranch = ConfigRecord | unknown[];

const isPersistedConfigValue = (value: unknown): value is PersistedConfigValue => value === null || ["boolean", "number", "string"].includes(typeof value);

const isConfigObject = (value: unknown): value is ConfigRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";

const cloneConfigValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => cloneConfigValue(item));
    if (isConfigObject(value)) return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, cloneConfigValue(childValue)]));
    return value;
};

const mergeConfigRecord = (target: ConfigRecord, source: ConfigRecord) => {
    for (const [key, value] of Object.entries(source)) {
        const currentValue = target[key];

        if (isConfigObject(value) && isConfigObject(currentValue)) {
            mergeConfigRecord(currentValue, value);
            continue;
        }

        target[key] = cloneConfigValue(value);
    }
};

const mergeConfig = (target: ConfigValue, source: Partial<ConfigValue>) => {
    mergeConfigRecord(target as unknown as ConfigRecord, source as ConfigRecord);
    return target;
};

const generatePairs = (obj: unknown, key = ""): ConfigEntity[] => {
    if (obj === undefined) return [];

    if (isPersistedConfigValue(obj)) {
        const ret = new ConfigEntity();
        ret.key = key;
        ret.value = obj;
        return [ret];
    }

    if (Array.isArray(obj) || isConfigObject(obj)) {
        return Object.entries(obj).flatMap(([childKey, value]) => generatePairs(value, key ? `${key}_${childKey}` : childKey));
    }

    throw new TypeError(`Config value '${key}' cannot be persisted as a database config entry`);
};

async function applyConfig(val: ConfigValue) {
    const configPath = process.env.CONFIG_PATH;
    const nextPairs = generatePairs(val);

    if (configPath) {
        if (!process.env.CONFIG_READONLY) await fs.writeFile(configPath, JSON.stringify(val, null, 4));
        else console.log("[WARNING] JSON config file in use, and writing is disabled! Programmatic config changes will not be persisted, and your config will not get updated!");
        pairs = nextPairs;
    } else {
        const nextKeys = new Set(nextPairs.map((pair) => pair.key));
        const staleKeys = pairs?.map((pair) => pair.key).filter((key) => !nextKeys.has(key)) ?? [];
        // keys are sorted to try to influence database order...
        await Promise.all(nextPairs.sort((x, y) => (x.key > y.key ? 1 : -1)).map((pair) => pair.save()));
        if (staleKeys.length) await ConfigEntity.delete(staleKeys);
        pairs = nextPairs;
    }
    return val;
}

function pairsToConfig(pairs: ConfigEntity[]) {
    const value: ConfigRecord = {};

    const isArrayKey = (key: string) => /^\d+$/.test(key);

    const getChild = (branch: ConfigBranch, key: string) => {
        if (Array.isArray(branch)) return branch[Number(key)];
        return branch[key];
    };

    const setChild = (branch: ConfigBranch, key: string, childValue: unknown) => {
        if (Array.isArray(branch)) branch[Number(key)] = childValue;
        else branch[key] = childValue;
    };

    const isBranch = (branch: unknown): branch is ConfigBranch => Array.isArray(branch) || isConfigObject(branch);

    pairs.forEach((p) => {
        const keys = p.key.split("_");
        let branch: ConfigBranch = value;

        if (p.value === undefined) return;
        if (!isPersistedConfigValue(p.value)) throw new TypeError(`Config value '${p.key}' cannot be loaded from a database config entry`);

        for (const [index, key] of keys.entries()) {
            if (index === keys.length - 1) {
                setChild(branch, key, p.value);
                continue;
            }

            const nextKey = keys[index + 1];
            const child = getChild(branch, key);
            if (isBranch(child)) {
                branch = child;
            } else {
                const nextBranch: ConfigBranch = isArrayKey(nextKey) ? [] : {};
                setChild(branch, key, nextBranch);
                branch = nextBranch;
            }
        }
    });

    return value as unknown as ConfigValue;
}

const validateConfig = async () => {
    let hasErrored = false;
    const totalStartTime = new Date();
    const config = await ConfigEntity.find({ select: { key: true } });

    for (const row in config) {
        // extension methods...
        if (typeof config[row] === "function") continue;

        try {
            const found = await ConfigEntity.findOne({
                where: { key: config[row].key },
            });
            if (!found) continue;
            config[row] = found;
        } catch (e) {
            console.error(`Config key '${config[row].key}' has invalid JSON value : ${(e as Error)?.message}`);
            hasErrored = true;
        }
    }

    console.log("[Config] Total config load time:", new Date().getTime() - totalStartTime.getTime(), "ms");

    if (hasErrored) {
        throw new Error("[Config] Your config has invalid values. Fix them first https://docs.spacebar.chat/setup/server/configuration");
    }

    return config;
};

function validateFinalConfig(config: ConfigValue) {
    let hasErrors = false;
    function assertConfig(path: string, condition: (val: JsonValue) => boolean, recommendedValue: string) {
        // _ to separate keys
        const keys = path.split("_");
        let obj: never = config as never;

        for (const key of keys) {
            if (obj == null || !(key in obj)) {
                console.warn(`[Config] Missing config value for '${path}'. Recommended value: ${recommendedValue}`);
                return;
            }
            obj = obj[key];
        }

        if (!condition(obj)) {
            console.warn(`[Config] Invalid config value for '${path}': ${obj}. Recommended value: ${recommendedValue}`);
            hasErrors = true;
        }
    }

    assertConfig(
        "general_serverName",
        (v) => v != null,
        'A valid domain hosting your .well-known (defaulting to https at port 443), eg. "spacebar.chat" or "http://localhost:3001"',
    );
    assertConfig("api_endpointPublic", (v) => v != null, 'A valid public API endpoint URL, eg. "http://localhost:3001/api/v9"');
    assertConfig("cdn_endpointPublic", (v) => v != null, 'A valid public CDN endpoint URL, eg. "http://localhost:3003/"');
    assertConfig("cdn_endpointPrivate", (v) => v != null, 'A valid private CDN endpoint URL, eg. "http://localhost:3003/" - must be routable from the API server!');
    assertConfig("gateway_endpointPublic", (v) => v != null, 'A valid public gateway endpoint URL, eg. "ws://localhost:3002/"');
    assertConfig(
        "gateway_heartbeatTimeout",
        isValidGatewayHeartbeatTimeout,
        `${DEFAULT_GATEWAY_HEARTBEAT_TIMEOUT} (must be greater than the advertised heartbeat interval of ${GATEWAY_HEARTBEAT_INTERVAL}ms)`,
    );
    assertConfig(
        "gateway_disconnectedSessionCleanupDelayMs",
        isValidGatewayDisconnectedSessionCleanupDelay,
        `${DEFAULT_GATEWAY_DISCONNECTED_SESSION_CLEANUP_DELAY_MS} (must be a non-negative millisecond delay)`,
    );

    if (hasErrors) {
        const message = "[Config] Your config has invalid values. Fix them first https://docs.spacebar.chat/setup/server/configuration";
        console.error(message);
        console.error("[Config] Hint: if you're just testing with bundle (`npm run start`), you can set all endpoint URLs to [proto]://localhost:3001");
        throw new Error(message);
    } else console.log("[Config] Configuration validated successfully.");
}

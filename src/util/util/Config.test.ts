import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ConfigValue } from "../config";
import { ConfigEntity } from "../entities/Config";
import { Config, findStaleConfigKeys, generateConfigPairs, pairsToConfig } from "./Config";

let tempDir: string | undefined;

function validConfig() {
    const config = new ConfigValue();
    config.general.serverName = "localhost";
    config.api.endpointPublic = "http://localhost:3001/api/v9";
    config.cdn.endpointPublic = "http://localhost:3001";
    config.cdn.endpointPrivate = "http://localhost:3001";
    config.gateway.endpointPublic = "ws://localhost:3001";
    return config;
}

async function writeConfigFile(config = validConfig()) {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-config-test-"));
    const configPath = path.join(tempDir, "config.json");
    await fs.writeFile(configPath, JSON.stringify(config, null, 4));
    return configPath;
}

function configPair(key: string, value: ConfigEntity["value"]) {
    const pair = new ConfigEntity();
    pair.key = key;
    pair.value = value;
    return pair;
}

function collectDeleteCriteriaKeys(criteria: unknown): string[] {
    if (typeof criteria === "string") return [criteria];
    if (Array.isArray(criteria)) return criteria.filter((key): key is string => typeof key === "string");
    if (typeof criteria !== "object" || criteria === null) return [];

    if ("key" in criteria) {
        const keyCriteria = (criteria as { key?: unknown }).key;
        if (typeof keyCriteria === "object" && keyCriteria !== null && "value" in keyCriteria) {
            return collectDeleteCriteriaKeys((keyCriteria as { value?: unknown }).value);
        }

        return collectDeleteCriteriaKeys(keyCriteria);
    }

    return [];
}

function patchConfigEntityPersistence(savedPairs: Pick<ConfigEntity, "key" | "value">[], deletedKeys: string[] = [], existingKeys: string[] = []) {
    const originalSave = ConfigEntity.prototype.save;
    const originalDelete = ConfigEntity.delete;
    const originalFind = ConfigEntity.find;

    ConfigEntity.prototype.save = async function (this: ConfigEntity) {
        savedPairs.push({ key: this.key, value: this.value });
        return this;
    };

    ConfigEntity.delete = ((criteria: unknown) => {
        deletedKeys.push(...collectDeleteCriteriaKeys(criteria));
        return Promise.resolve({ affected: deletedKeys.length, raw: [] });
    }) as typeof ConfigEntity.delete;

    ConfigEntity.find = (async () => existingKeys.map((key) => configPair(key, null))) as typeof ConfigEntity.find;

    return () => {
        ConfigEntity.prototype.save = originalSave;
        ConfigEntity.delete = originalDelete;
        ConfigEntity.find = originalFind;
    };
}

test("database config pair generation stores arrays as single JSON values", () => {
    const config = validConfig();
    config.register.email.domains = ["blocked.example", "mail.example"];

    const pairs = generateConfigPairs(config);
    const domainsPair = pairs.find((pair) => pair.key === "register_email_domains");

    assert.ok(domainsPair);
    assert.deepEqual(domainsPair.value, ["blocked.example", "mail.example"]);
    assert.equal(
        pairs.some((pair) => pair.key.startsWith("register_email_domains_")),
        false,
    );
});

test("database config pair generation skips undefined leaves and rejects unsupported values", () => {
    const config = validConfig() as ConfigValue & {
        customConfigPairGeneration?: {
            persisted: string;
            skipped?: undefined;
        };
    };
    config.customConfigPairGeneration = { persisted: "yes", skipped: undefined };

    const pairs = generateConfigPairs(config);

    assert.equal(
        pairs.some((pair) => pair.key === "customConfigPairGeneration_persisted"),
        true,
    );
    assert.equal(
        pairs.some((pair) => pair.key === "customConfigPairGeneration_skipped"),
        false,
    );
    assert.throws(() => generateConfigPairs({ bad: () => undefined }), /cannot be persisted/);
    assert.throws(() => generateConfigPairs({ bad: Number.NaN }), /cannot be persisted/);
});

test("database config pair loading supports JSON array rows and legacy indexed rows", () => {
    const jsonArrayConfig = pairsToConfig([configPair("register_email_domains", ["blocked.example", "mail.example"])]);
    assert.deepEqual(jsonArrayConfig.register.email.domains, ["blocked.example", "mail.example"]);

    const legacyIndexedConfig = pairsToConfig([configPair("register_email_domains_0", "blocked.example"), configPair("register_email_domains_1", "mail.example")]);
    assert.deepEqual(legacyIndexedConfig.register.email.domains, ["blocked.example", "mail.example"]);
});

test("database config pair loading prefers JSON parent rows over stale indexed children", () => {
    const config = pairsToConfig([configPair("register_email_domains", ["blocked.example"]), configPair("register_email_domains_0", "stale.example")]);

    assert.deepEqual(config.register.email.domains, ["blocked.example"]);
});

test("database config persistence removes stale flattened children when a parent is saved as JSON", () => {
    assert.deepEqual(
        findStaleConfigKeys(
            ["register_email_domains_0", "register_email_domains_1", "register_email_domains", "general_serverName", "custom_unknown_key"],
            ["register_email_domains", "general_serverName"],
        ),
        ["register_email_domains_0", "register_email_domains_1"],
    );
});

afterEach(async () => {
    delete process.env.CONFIG_PATH;
    delete process.env.CONFIG_READONLY;
    delete process.env.CONFIG_SOURCE;

    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
});

test("Config.set merges partial config updates into memory and persists the full JSON config", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    await Config.set({
        updates: {
            ...Config.get().updates,
            lastNotifiedCommit: "abc123",
        },
    });

    assert.equal(Config.get().updates.lastNotifiedCommit, "abc123");

    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.equal(persisted.updates.lastNotifiedCommit, "abc123");
    assert.equal(persisted.updates.branch, "mistress");
    assert.equal(persisted.general.serverName, "localhost");
    assert.equal(persisted.api.endpointPublic, "http://localhost:3001/api/v9");
    assert.equal(persisted.cdn.endpointPrivate, "http://localhost:3001");
    assert.equal(persisted.gateway.endpointPublic, "ws://localhost:3001");
});

test("Config.set writes to the current CONFIG_PATH even when the module was imported first", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    await Config.set({
        updates: {
            ...Config.get().updates,
            lastNotifiedCommit: "current-path",
        },
    });

    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.equal(persisted.updates.lastNotifiedCommit, "current-path");
});

test("Config.set replaces array config values instead of leaving stale entries", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    await Config.set({
        register: {
            ...Config.get().register,
            email: {
                ...Config.get().register.email,
                domains: ["blocked.example", "mail.example"],
            },
        },
    });
    await Config.set({
        register: {
            ...Config.get().register,
            email: {
                ...Config.get().register.email,
                domains: ["blocked.example"],
            },
        },
    });

    assert.deepEqual(Config.get().register.email.domains, ["blocked.example"]);

    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.deepEqual(persisted.register.email.domains, ["blocked.example"]);
});

test("Config.set persists JSON array database pairs and deletes legacy flattened children", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    delete process.env.CONFIG_PATH;

    const deletedKeys: string[] = [];
    const savedPairs: Pick<ConfigEntity, "key" | "value">[] = [];
    const restorePersistence = patchConfigEntityPersistence(savedPairs, deletedKeys, ["guild_defaultFeatures_0", "guild_defaultFeatures_1"]);

    try {
        await Config.set({
            guild: {
                ...Config.get().guild,
                defaultFeatures: ["COMMUNITY", "NEWS"],
            },
        });
    } finally {
        restorePersistence();
    }

    const defaultFeaturesPair = savedPairs.find((pair) => pair.key === "guild_defaultFeatures");
    assert.deepEqual(defaultFeaturesPair?.value, ["COMMUNITY", "NEWS"]);
    assert.equal(
        savedPairs.some((pair) => pair.key.startsWith("guild_defaultFeatures_")),
        false,
    );
    assert.deepEqual(deletedKeys, ["guild_defaultFeatures_0", "guild_defaultFeatures_1"]);
});

test("Config.set does not persist undefined default values as database config pairs", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    delete process.env.CONFIG_PATH;

    const savedPairs: Pick<ConfigEntity, "key" | "value">[] = [];
    const restorePersistence = patchConfigEntityPersistence(savedPairs);

    try {
        await Config.set({});
    } finally {
        restorePersistence();
    }

    assert.equal(
        savedPairs.some((pair) => pair.value === undefined),
        false,
    );
    assert.equal(
        savedPairs.some((pair) => pair.key === "register_defaultBotRights"),
        false,
    );
    assert.equal(
        savedPairs.some((pair) => pair.key === "components_mediaGalleryLimit"),
        false,
    );
    assert.equal(
        savedPairs.some((pair) => pair.key === "components_actionRowLimit"),
        false,
    );
});

test("Config.set rejects unsupported CAPTCHA service updates without mutating current config", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    await assert.rejects(async () => {
        await Config.set({
            security: {
                captcha: {
                    enabled: true,
                    service: "turnstile",
                    sitekey: "turnstile-sitekey",
                    secret: "turnstile-secret",
                },
            },
        } as unknown as Partial<ConfigValue>);
    }, /Your config has invalid values/);

    assert.equal(Config.get().security.captcha.enabled, false);
    assert.equal(Config.get().security.captcha.service, null);
    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.equal(persisted.security.captcha.enabled, false);
    assert.equal(persisted.security.captcha.service, null);
});

test("Config.init rejects unsupported CAPTCHA services", async () => {
    const config = validConfig();
    (config.security.captcha as { service: string }).service = "turnstile";
    process.env.CONFIG_PATH = await writeConfigFile(config);

    await assert.rejects(() => Config.init(true), /Your config has invalid values/);
});

test("Config.init rejects enabled CAPTCHA without complete provider settings", async () => {
    const config = validConfig();
    config.security.captcha.enabled = true;
    config.security.captcha.service = "hcaptcha";
    config.security.captcha.secret = "hcaptcha-secret";
    process.env.CONFIG_PATH = await writeConfigFile(config);

    await assert.rejects(() => Config.init(true), /Your config has invalid values/);
});

test("Config.init accepts enabled CAPTCHA with hCaptcha provider settings", async () => {
    const config = validConfig();
    config.security.captcha.enabled = true;
    config.security.captcha.service = "hcaptcha";
    config.security.captcha.sitekey = "hcaptcha-sitekey";
    config.security.captcha.secret = "hcaptcha-secret";
    process.env.CONFIG_PATH = await writeConfigFile(config);

    await Config.init(true);

    assert.equal(Config.get().security.captcha.service, "hcaptcha");
    assert.equal(Config.get().security.captcha.sitekey, "hcaptcha-sitekey");
    assert.equal(Config.get().security.captcha.secret, "hcaptcha-secret");
});

test("pairsToConfig reconstructs nested config objects from database pairs", () => {
    const config = pairsToConfig([
        configPair("general_serverName", "localhost"),
        configPair("api_endpointPublic", "http://localhost:3001/api/v9"),
        configPair("register_allowNewRegistration", false),
        configPair("limits_user_maxGuilds", 100),
        configPair("email_smtp_password", null),
    ]);

    assert.equal(config.general.serverName, "localhost");
    assert.equal(config.api.endpointPublic, "http://localhost:3001/api/v9");
    assert.equal(config.register.allowNewRegistration, false);
    assert.equal(config.limits.user.maxGuilds, 100);
    assert.equal(config.email.smtp.password, null);
});

test("pairsToConfig reconstructs arrays from numeric database path segments", () => {
    const config = pairsToConfig([
        configPair("regions_available_0_id", "spacebar"),
        configPair("regions_available_0_name", "Spacebar"),
        configPair("regions_available_0_endpoint", "127.0.0.1:3004"),
        configPair("regions_available_0_vip", false),
        configPair("regions_available_1_id", "backup"),
        configPair("regions_available_1_name", "Backup"),
        configPair("regions_available_1_endpoint", "127.0.0.1:3005"),
        configPair("regions_available_1_vip", true),
    ]);

    assert.deepEqual(config.regions.available, [
        { id: "spacebar", name: "Spacebar", endpoint: "127.0.0.1:3004", vip: false },
        { id: "backup", name: "Backup", endpoint: "127.0.0.1:3005", vip: true },
    ]);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ConfigValue } from "../config";
import { ConfigEntity } from "../entities";
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

async function writeConfigFile() {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-config-test-"));
    const configPath = path.join(tempDir, "config.json");
    await fs.writeFile(configPath, JSON.stringify(validConfig(), null, 4));
    return configPath;
}

function configPair(key: string, value: ConfigEntity["value"]) {
    const pair = new ConfigEntity();
    pair.key = key;
    pair.value = value;
    return pair;
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

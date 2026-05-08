import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ConfigValue } from "../config";
import { ConfigEntity } from "../entities";
import { Config, pairsToConfig } from "./Config";

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

function configPair(key: string, value: ConfigEntity["value"]) {
    return Object.assign(new ConfigEntity(), { key, value });
}

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

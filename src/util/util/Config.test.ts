import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ConfigValue } from "../config";
import { Config } from "./Config";

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

async function writeLegacyConfigFileWithoutCors() {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-config-test-"));
    const configPath = path.join(tempDir, "config.json");
    const config = validConfig() as Partial<ConfigValue>;
    delete config.cors;
    await fs.writeFile(configPath, JSON.stringify(config, null, 4));
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

test("Config.init persists default CORS settings for existing JSON configs", async () => {
    const configPath = await writeLegacyConfigFileWithoutCors();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);

    assert.deepEqual(Config.get().cors.allowedOrigins, ["*"]);
    assert.deepEqual(Config.get().cors.allowedMethods, ["*"]);
    assert.deepEqual(Config.get().cors.allowedHeaders, ["*"]);
    assert.equal(Config.get().cors.enabled, true);
    assert.equal(Config.get().cors.allowCredentials, true);
    assert.equal(Config.get().cors.maxAgeSeconds, 60);

    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.deepEqual(persisted.cors, { ...Config.get().cors });
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

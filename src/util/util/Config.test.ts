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

async function writeConfigFile(config = validConfig()) {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spacebar-config-test-"));
    const configPath = path.join(tempDir, "config.json");
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

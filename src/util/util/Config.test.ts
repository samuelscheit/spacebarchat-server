import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { ConfigValue } from "../config";
import { ConfigEntity } from "../entities";
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

afterEach(async () => {
    delete process.env.CONFIG_PATH;
    delete process.env.CONFIG_READONLY;
    delete process.env.CONFIG_SOURCE;

    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
});

function patchConfigEntityPersistence(savedPairs: Pick<ConfigEntity, "key" | "value">[], deletedKeys: string[] = []) {
    const originalSave = ConfigEntity.prototype.save;
    const originalDelete = ConfigEntity.delete;

    ConfigEntity.prototype.save = async function (this: ConfigEntity) {
        savedPairs.push({ key: this.key, value: this.value });
        return this;
    };

    ConfigEntity.delete = ((criteria: unknown) => {
        if (typeof criteria === "string") deletedKeys.push(criteria);
        else if (Array.isArray(criteria)) deletedKeys.push(...criteria.filter((key): key is string => typeof key === "string"));

        return Promise.resolve({ affected: deletedKeys.length, raw: [] });
    }) as typeof ConfigEntity.delete;

    return () => {
        ConfigEntity.prototype.save = originalSave;
        ConfigEntity.delete = originalDelete;
    };
}

function configFindOneKey(options: unknown) {
    if (typeof options !== "object" || options === null || !("where" in options)) return undefined;

    const where = (options as { where?: unknown }).where;
    if (typeof where !== "object" || where === null || !("key" in where)) return undefined;

    const key = (where as { key?: unknown }).key;
    return typeof key === "string" ? key : undefined;
}

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

test("Config.set persists nested array values as typed database config pairs", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    delete process.env.CONFIG_PATH;

    const deletedKeys: string[] = [];
    const savedPairs: Pick<ConfigEntity, "key" | "value">[] = [];
    const restorePersistence = patchConfigEntityPersistence(savedPairs, deletedKeys);

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

    assert.deepEqual(
        savedPairs.filter((pair) => pair.key.startsWith("guild_defaultFeatures")).sort((left, right) => left.key.localeCompare(right.key)),
        [
            { key: "guild_defaultFeatures_0", value: "COMMUNITY" },
            { key: "guild_defaultFeatures_1", value: "NEWS" },
        ],
    );
    assert.deepEqual(
        deletedKeys.filter((key) => key.startsWith("guild_defaultFeatures")),
        [],
    );
});

test("Config.set replaces arrays instead of merging stale indexes", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    await Config.set({
        guild: {
            ...Config.get().guild,
            defaultFeatures: ["COMMUNITY", "NEWS"],
        },
    });
    await Config.set({
        guild: {
            ...Config.get().guild,
            defaultFeatures: ["COMMUNITY"],
        },
    });

    assert.deepEqual(Config.get().guild.defaultFeatures, ["COMMUNITY"]);

    const persisted = JSON.parse(await fs.readFile(configPath, "utf8")) as ConfigValue;
    assert.deepEqual(persisted.guild.defaultFeatures, ["COMMUNITY"]);
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

test("Config.set deletes stale database config pairs when arrays shrink", async () => {
    const configPath = await writeConfigFile();
    process.env.CONFIG_PATH = configPath;

    await Config.init(true);
    delete process.env.CONFIG_PATH;

    const deletedKeys: string[] = [];
    const savedPairs: Pick<ConfigEntity, "key" | "value">[] = [];
    const restorePersistence = patchConfigEntityPersistence(savedPairs, deletedKeys);

    try {
        await Config.set({
            guild: {
                ...Config.get().guild,
                defaultFeatures: ["COMMUNITY", "NEWS"],
            },
        });

        savedPairs.length = 0;
        deletedKeys.length = 0;

        await Config.set({
            guild: {
                ...Config.get().guild,
                defaultFeatures: ["COMMUNITY"],
            },
        });
    } finally {
        restorePersistence();
    }

    assert.deepEqual(Config.get().guild.defaultFeatures, ["COMMUNITY"]);
    assert.deepEqual(
        savedPairs.filter((pair) => pair.key.startsWith("guild_defaultFeatures")).map((pair) => pair.key),
        ["guild_defaultFeatures_0"],
    );
    assert.deepEqual(
        deletedKeys.filter((key) => key.startsWith("guild_defaultFeatures")),
        ["guild_defaultFeatures_1"],
    );
});

test("Config.init reconstructs nested arrays from typed database config pairs", async () => {
    const originalFind = ConfigEntity.find;
    const originalFindOne = ConfigEntity.findOne;
    const savedPairs: Pick<ConfigEntity, "key" | "value">[] = [];
    const restorePersistence = patchConfigEntityPersistence(savedPairs);
    const storedPairs = [
        Object.assign(new ConfigEntity(), { key: "general_serverName", value: "localhost" }),
        Object.assign(new ConfigEntity(), { key: "api_endpointPublic", value: "http://localhost:3001/api/v9" }),
        Object.assign(new ConfigEntity(), { key: "cdn_endpointPublic", value: "http://localhost:3001" }),
        Object.assign(new ConfigEntity(), { key: "cdn_endpointPrivate", value: "http://localhost:3001" }),
        Object.assign(new ConfigEntity(), { key: "gateway_endpointPublic", value: "ws://localhost:3001" }),
        Object.assign(new ConfigEntity(), { key: "guild_defaultFeatures_0", value: "COMMUNITY" }),
        Object.assign(new ConfigEntity(), { key: "guild_defaultFeatures_1", value: "NEWS" }),
    ];

    process.env.CONFIG_SOURCE = "database";
    ConfigEntity.find = (async () => storedPairs.map((pair) => Object.assign(new ConfigEntity(), { key: pair.key }))) as typeof ConfigEntity.find;
    ConfigEntity.findOne = (async (options: unknown) => storedPairs.find((pair) => pair.key === configFindOneKey(options)) ?? null) as typeof ConfigEntity.findOne;

    try {
        await Config.init(true);
    } finally {
        ConfigEntity.find = originalFind;
        ConfigEntity.findOne = originalFindOne;
        restorePersistence();
        delete process.env.CONFIG_SOURCE;
    }

    assert.deepEqual(Config.get().guild.defaultFeatures, ["COMMUNITY", "NEWS"]);
});

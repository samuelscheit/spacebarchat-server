import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";

test("User.badge_ids TypeORM metadata matches the string badge id migration", async () => {
    process.env.DATABASE ??= "postgres://localhost/spacebar";

    const { User } = await import("./User.js");
    const badgeIdsColumn = getMetadataArgsStorage().columns.find((column) => column.target === User && column.propertyName === "badge_ids");

    assert.ok(badgeIdsColumn, "User.badge_ids column metadata should exist");
    assert.equal(badgeIdsColumn.options.type, "varchar");
    assert.equal(badgeIdsColumn.options.array, true);
    assert.equal(badgeIdsColumn.options.nullable, true);
});

test("User.premium_since keeps nullable Date column metadata", () => {
    const source = readFileSync(path.join(process.cwd(), "src/util/entities/User.ts"), "utf8");

    assert.match(source, /@Column\(\{\s*nullable:\s*true,\s*type:\s*Date\s*\}\)\s+premium_since\?: Date \| null;/);
});

test("User.register only persists validated registration fingerprints on new users", async () => {
    const [{ User }, { UserSettings }, { Config }, { Snowflake }, { createClientFingerprint }] = await Promise.all([
        import("./User.js"),
        import("./UserSettings.js"),
        import("../util/Config.js"),
        import("../util/Snowflake.js"),
        import("../util/Fingerprint.js"),
    ]);

    type MutableStatic = Record<string, unknown>;
    const mutableUser = User as unknown as MutableStatic;
    const mutableUserSettings = UserSettings as unknown as MutableStatic;
    const mutableConfig = Config as unknown as MutableStatic;
    const mutableSnowflake = Snowflake as unknown as MutableStatic;

    const originalUserGetRepository = mutableUser.getRepository;
    const originalUserSettingsGetRepository = mutableUserSettings.getRepository;
    const originalConfigGet = mutableConfig.get;
    const originalSnowflakeGenerate = mutableSnowflake.generate;

    const savedUsers: unknown[] = [];

    try {
        mutableConfig.get = () => ({
            defaults: {
                user: {
                    premium: false,
                    premiumType: 0,
                    verified: true,
                },
            },
            guild: {
                autoJoin: {
                    bots: false,
                    enabled: false,
                    guilds: [],
                },
            },
            register: {
                defaultRights: "0",
                incrementingDiscriminators: true,
            },
            security: {
                requestSignature: "user-register-fingerprint-test-secret",
            },
        });
        const fingerprint = createClientFingerprint();
        mutableSnowflake.generate = () => "registered-user";
        mutableUser.getRepository = () => ({
            create(entity: object) {
                return Object.assign(new User(), entity);
            },
            async find() {
                return [];
            },
            async save(user: unknown) {
                savedUsers.push(user);
                return user;
            },
        });
        mutableUserSettings.getRepository = () => ({
            create(entity: object) {
                return Object.assign(new UserSettings(), entity);
            },
        });

        const user = await User.register({
            username: "fingerprint-user",
            fingerprint,
            emitSideEffects: false,
        });

        assert.equal(savedUsers.length, 1);
        assert.equal(user.id, "registered-user");
        assert.deepEqual(user.fingerprints, [fingerprint]);

        const invalidFingerprintUser = await User.register({
            username: "invalid-fingerprint-user",
            fingerprint: "1234567890.example",
            emitSideEffects: false,
        });

        assert.equal(savedUsers.length, 2);
        assert.deepEqual(invalidFingerprintUser.fingerprints, []);
    } finally {
        mutableUser.getRepository = originalUserGetRepository;
        mutableUserSettings.getRepository = originalUserSettingsGetRepository;
        mutableConfig.get = originalConfigGet;
        mutableSnowflake.generate = originalSnowflakeGenerate;
    }
});

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

test("User.register derives nsfw_allowed from date_of_birth instead of storing date_of_birth", async () => {
    const { User } = await import("./User.js");
    const dateOfBirthColumn = getMetadataArgsStorage().columns.find((column) => column.target === User && column.propertyName === "date_of_birth");
    const savedUsers: InstanceType<typeof User>[] = [];
    const userRepository = {
        find: async () => [],
        create: (properties: Partial<InstanceType<typeof User>>) => Object.assign(new User(), properties),
        save: async (user: InstanceType<typeof User>) => {
            savedUsers.push(user);
            return user;
        },
    };
    const settingsRepository = {
        create: (properties: object) => properties,
    };
    const manager = {
        getRepository: (entity: unknown) => (entity === User ? userRepository : settingsRepository),
    };

    const adult = await User.register({
        username: "adult",
        date_of_birth: "1990-01-01",
        manager: manager as never,
        emitSideEffects: false,
    });
    const underage = await User.register({
        username: "underage",
        date_of_birth: new Date(),
        manager: manager as never,
        emitSideEffects: false,
    });

    assert.equal(adult.nsfw_allowed, true);
    assert.equal(underage.nsfw_allowed, false);
    assert.equal(User.calculateNsfwAllowed("invalid-date"), false);
    assert.equal(dateOfBirthColumn, undefined, "date_of_birth should not be a persisted User column");
    assert.equal(savedUsers.length, 2);
    for (const user of savedUsers) {
        assert.equal("date_of_birth" in user, false, "date_of_birth should not be persisted on User entities");
    }

    const serializedUser = Object.assign(new User(), adult, { date_of_birth: "1990-01-01" });
    assert.equal("date_of_birth" in serializedUser.toPublicUser(), false, "date_of_birth should not be serialized publicly");
    assert.equal("date_of_birth" in serializedUser.toPrivateUser(), false, "date_of_birth should not be serialized privately");
});

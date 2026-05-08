import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { type EntityManager, getMetadataArgsStorage } from "typeorm";
import { User } from "./User";
import { UserSettings } from "./UserSettings";

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

test("User flag bitfields keep bigint storage and JSON number serialization", async () => {
    process.env.DATABASE ??= "postgres://localhost/spacebar";

    const { User } = await import("./User.js");
    const { bigintNumberTransformer } = await import("../util/DatabaseTransformers.js");
    const flagColumnNames = ["flags", "public_flags", "purchased_flags"];

    for (const propertyName of flagColumnNames) {
        const column = getMetadataArgsStorage().columns.find((column) => column.target === User && column.propertyName === propertyName);

        assert.ok(column, `User.${propertyName} column metadata should exist`);
        assert.equal(column.options.type, "bigint");
        assert.equal(column.options.transformer, bigintNumberTransformer);
    }

    const user = new User();
    user.flags = "17592186044416" as unknown as number;
    user.public_flags = "1" as unknown as number;
    user.purchased_flags = "2" as unknown as number;
    user.premium_usage_flags = "3" as unknown as number;

    user.clean_data();

    assert.equal(user.flags, 17592186044416);
    assert.equal(user.public_flags, 1);
    assert.equal(user.purchased_flags, 2);
    assert.equal(user.premium_usage_flags, "3", "unannotated premium_usage_flags is not part of the bigint JSON number conversion");
});

test("User.isAdult allows users on and after their eighteenth birthday", () => {
    const now = new Date("2026-05-08T12:00:00.000Z");

    assert.equal(User.isAdult("2008-05-08", now), true);
    assert.equal(User.isAdult(new Date("2000-04-03T00:00:00.000Z"), now), true);
});

test("User.isAdult rejects users before their eighteenth birthday", () => {
    const now = new Date("2026-05-08T12:00:00.000Z");

    assert.equal(User.isAdult("2008-05-09", now), false);
    assert.equal(User.isAdult("2013-05-08", now), false);
});

test("User.isAdult rejects invalid dates", () => {
    assert.equal(User.isAdult("not-a-date", new Date("2026-05-08T12:00:00.000Z")), false);
    assert.equal(User.isAdult("", new Date("2026-05-08T12:00:00.000Z")), false);
    assert.equal(User.isAdult("2010-02-31", new Date("2026-05-08T12:00:00.000Z")), false);
});

function createRegistrationManager() {
    const userRepository = {
        find: async () => [],
        create: (user: Partial<User>) => Object.assign(new User(), user),
        save: async (user: User) => user,
    };
    const settingsRepository = {
        create: (settings: Partial<UserSettings>) => Object.assign(new UserSettings(), settings),
    };

    const manager = {
        getRepository(entity: unknown) {
            if (entity === User) return userRepository;
            if (entity === UserSettings) return settingsRepository;

            throw new Error("Unexpected repository requested by User.register test");
        },
    } as unknown as EntityManager;

    return manager;
}

async function registerTestUser(date_of_birth?: Date | string) {
    return User.register({
        username: "register-test-user",
        password: "hashed-password",
        date_of_birth,
        manager: createRegistrationManager(),
        emitSideEffects: false,
    });
}

test("User.register derives nsfw_allowed from supplied date_of_birth", async () => {
    assert.equal(User.nsfwAllowedAge, 18);

    const adult = await registerTestUser("1900-01-01");
    const notAdult = await registerTestUser("2999-01-01");
    const blankDateOfBirth = await registerTestUser("");

    assert.equal(adult.nsfw_allowed, true);
    assert.equal(notAdult.nsfw_allowed, false);
    assert.equal(blankDateOfBirth.nsfw_allowed, false);
});

test("User.register preserves the legacy nsfw_allowed default when date_of_birth is absent", async () => {
    const user = await registerTestUser();

    assert.equal(user.nsfw_allowed, true);
});

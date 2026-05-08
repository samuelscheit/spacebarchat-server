import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import { User } from "./User";

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
});

test("User.register stores nsfw_allowed from supplied date_of_birth and preserves the legacy default when absent", () => {
    const source = readFileSync(path.join(process.cwd(), "src/util/entities/User.ts"), "utf8");

    assert.equal(User.nsfwAllowedAge, 18);
    assert.match(source, /const nsfwAllowed = date_of_birth \? User\.isAdult\(date_of_birth\) : true;/);
    assert.match(source, /nsfw_allowed: nsfwAllowed,/);
});

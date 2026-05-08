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

test("User.normalizeDiscriminator pads valid numeric discriminators", async () => {
    process.env.DATABASE ??= "postgres://localhost/spacebar";

    const { User } = await import("./User.js");

    assert.equal(User.normalizeDiscriminator("1"), "0001");
    assert.equal(User.normalizeDiscriminator("0001"), "0001");
    assert.equal(User.normalizeDiscriminator("42"), "0042");
    assert.equal(User.normalizeDiscriminator("0042"), "0042");
    assert.equal(User.normalizeDiscriminator("9999"), "9999");
});

test("User.normalizeDiscriminator rejects invalid discriminators", async () => {
    process.env.DATABASE ??= "postgres://localhost/spacebar";

    const { User } = await import("./User.js");

    for (const discriminator of ["0", "0000", "10000", "1.5", "1e3", "0x10", "+1", "-1", " 42", "42 ", "9999.0", "abcd", ""]) {
        assert.throws(
            () => User.normalizeDiscriminator(discriminator),
            (error: unknown) => {
                assert.equal((error as { code?: number }).code, 50035);
                assert.equal((error as { errors?: { discriminator?: { _errors?: { code?: string }[] } } }).errors?.discriminator?._errors?.[0]?.code, "DISCRIMINATOR_INVALID");
                return true;
            },
            `expected ${JSON.stringify(discriminator)} to be rejected`,
        );
    }
});

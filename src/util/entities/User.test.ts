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

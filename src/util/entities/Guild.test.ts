import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getMetadataArgsStorage } from "typeorm";

describe("Guild entity metadata", () => {
    test("uses explicit database types for nullable discovery metadata backing columns", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar";
        const { Guild } = await import("./Guild.js");
        const columns = getMetadataArgsStorage().columns.filter((column) => column.target === Guild);

        assert.equal(columns.find((column) => column.propertyName === "description")?.options.type, "varchar");
        assert.equal(columns.find((column) => column.propertyName === "primary_category_id")?.options.type, "int8");
    });
});

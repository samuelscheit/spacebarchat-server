import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getMetadataArgsStorage } from "typeorm";
import { bigintNumberTransformer } from "./DatabaseTransformers";

describe("database transformers", () => {
    test("converts hydrated bigint values to numbers", () => {
        const transformed = bigintNumberTransformer.from("64");

        assert.equal(transformed, 64);
        assert.equal(typeof transformed, "number");
    });

    test("passes numbers and empty values through", () => {
        assert.equal(bigintNumberTransformer.from(0), 0);
        assert.equal(bigintNumberTransformer.from(null), null);
        assert.equal(bigintNumberTransformer.from(undefined), undefined);
        assert.equal(bigintNumberTransformer.to(64), 64);
    });

    test("applies bigint number conversion to hydrated user flag columns", async () => {
        process.env.DATABASE ??= "postgres://user:password@localhost:5432/database";
        const { User } = await import("../entities/User.js");
        const userColumns = getMetadataArgsStorage().columns.filter((column) => column.target === User);

        for (const propertyName of ["flags", "public_flags", "purchased_flags"]) {
            const column = userColumns.find((column) => column.propertyName === propertyName);

            assert.equal(column?.options.type, "bigint");
            assert.equal(column?.options.transformer, bigintNumberTransformer);
        }
    });
});

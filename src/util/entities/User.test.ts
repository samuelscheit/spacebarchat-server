import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("User entity metadata", () => {
    test("keeps nullable premium_since mapped as an explicit Date column", () => {
        const source = readFileSync(path.join(process.cwd(), "src/util/entities/User.ts"), "utf8");

        assert.match(source, /@Column\(\{\s*nullable:\s*true,\s*type:\s*Date\s*\}\)\s+premium_since\?: Date \| null;/);
    });
});

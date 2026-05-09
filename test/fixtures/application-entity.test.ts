import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ApplicationType } from "../../src/schemas/api/developers/Application";

describe("Application entity metadata", () => {
    test("stores application type as a nullable numeric enum column", () => {
        const applicationSource = readFileSync(path.join(process.cwd(), "src", "util", "entities", "Application.ts"), "utf8");

        assert.match(applicationSource, /@Column\(\{\s*type:\s*"int",\s*nullable:\s*true\s*\}\)\s+type\?: ApplicationType \| null;/);
        assert.doesNotMatch(applicationSource, /type\?: object/);
        assert.doesNotMatch(applicationSource, /@Column\(\{\s*type:\s*"jsonb",\s*nullable:\s*true\s*\}\)\s+type\?/);
        assert.equal(ApplicationType.GAME, 1);
    });
});

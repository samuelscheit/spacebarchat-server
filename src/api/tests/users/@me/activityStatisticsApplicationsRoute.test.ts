import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const routePath = path.join(process.cwd(), "src", "api", "routes", "users", "@me", "activities", "statistics", "applications.ts");

describe("GET /users/@me/activities/statistics/applications", () => {
    test("documents the empty activity statistics compatibility response", () => {
        const source = fs.readFileSync(routePath, "utf-8");

        assert.match(source, /router\.get\("\/", route\(\{\}\),/);
        assert.match(source, /res\.status\(200\)\.json\(\[\]\)/);
        assert.doesNotMatch(source, /\/\/\s*TODO:\s*(?:\r?\n|$)/);
    });
});

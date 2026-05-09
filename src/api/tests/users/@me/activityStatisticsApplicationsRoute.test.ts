import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const routePath = path.join(process.cwd(), "src", "api", "routes", "users", "@me", "activities", "statistics", "applications.ts");

describe("GET /users/@me/activities/statistics/applications", () => {
    test("removes the stale bare TODO from the route source", () => {
        const source = fs.readFileSync(routePath, "utf-8");

        assert.doesNotMatch(source, /\/\/\s*TODO:\s*(?:\r?\n|$)/);
    });
});

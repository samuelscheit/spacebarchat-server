"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..", "..");
const templateRoutePath = path.join(repoRoot, "src", "api", "routes", "template.ts.disabled");

test("disabled route template does not contain stale scaffold TODO comments", () => {
    const source = fs.readFileSync(templateRoutePath, "utf8");

    assert.doesNotMatch(source, /^\s*\/\/\s*(?:TODO|FIXME):?\s*this is a template for a generic route\s*$/imu);
});

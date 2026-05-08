import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("instance startup does not clear clustered authentication sessions", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "api", "util", "handlers", "Instance.ts"), "utf8");

    assert.doesNotMatch(source, /Session\.clear\s*\(/);
    assert.doesNotMatch(source, /Like\("TEMP_%"\)/);
    assert.match(source, /where\("last_seen = '1970\/01\/01'"\)/);
    assert.match(source, /totalHours > 1/);
    assert.match(source, /Session\.delete\(\{ session_id: session\.session_session_id \}\)/);
});

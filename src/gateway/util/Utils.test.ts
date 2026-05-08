import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("cleanupOnStartup does not perform the removed legacy voice-state wipe", async () => {
    const source = await readFile(path.join(__dirname, "../../../src/gateway/util/Utils.ts"), "utf8");

    assert.doesNotMatch(source, /VoiceState\.clear\s*\(/);
    assert.doesNotMatch(source, /Starting async voice state wipe/);
    assert.match(source, /expireOldPresenceStates\s*\(\)/);
});

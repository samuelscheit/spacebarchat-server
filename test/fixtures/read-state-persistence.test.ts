import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("Member does not own read-state persistence", () => {
    const memberSource = readFileSync(resolve(process.cwd(), "src/util/entities/Member.ts"), "utf8");
    const readStateSource = readFileSync(resolve(process.cwd(), "src/util/entities/ReadState.ts"), "utf8");

    assert.doesNotMatch(memberSource, /read_state\??\s*:/);
    assert.doesNotMatch(memberSource, /read_state:\s*\{\}/);
    assert.doesNotMatch(memberSource, /proper read receipts/);

    assert.match(readStateSource, /@Entity\(\{\s*name: "read_states",\s*\}\)/);
    assert.match(readStateSource, /@Index\("IDX_read_states_user_resource_type", \["channel_id", "user_id", "read_state_type"\], \{ unique: true \}\)/);
});

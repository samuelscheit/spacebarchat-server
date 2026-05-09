import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { HTTPError } from "lambert-server";
import { normalizeGuildProfileTag } from "./#guild_id/index";

test("guild profile tag updates normalize persisted custom tags", () => {
    assert.equal(normalizeGuildProfileTag(undefined), undefined);
    assert.equal(normalizeGuildProfileTag(null), null);
    assert.equal(normalizeGuildProfileTag("sb"), "SB");
    assert.equal(normalizeGuildProfileTag("42"), "42");
});

test("guild profile tag updates reject invalid custom tags", () => {
    for (const tag of ["", "ABCDE", "A-B", "TAG!", "A B", " SB ", "ß", "ı"]) {
        assert.throws(() => normalizeGuildProfileTag(tag), HTTPError, tag);
    }
});

test("guild profile response reads the persisted custom tag without deriving one from the guild name", () => {
    const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "profile.ts"), "utf8");

    assert.match(routeSource, /tag:\s*guild\.profile_tag \?\? null/);
    assert.doesNotMatch(routeSource, /substring\(0, 4\)/);
    assert.doesNotMatch(routeSource, /TODO:\s*allow custom tags/);
});

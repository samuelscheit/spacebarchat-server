import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUpdateNotificationMessage, hasStaffUserFlag, shouldNotifyUpdate, summarizeCommitMessages } from "./UpdateCheckerMessages";

test("shouldNotifyUpdate only notifies for unseen newer commits", () => {
    assert.equal(shouldNotifyUpdate(null, "def", null), false);
    assert.equal(shouldNotifyUpdate("abc", null, null), false);
    assert.equal(shouldNotifyUpdate("abc", "abc", null), false);
    assert.equal(shouldNotifyUpdate("abc", "def", "def"), false);
    assert.equal(shouldNotifyUpdate("abc", "def", null), true);
    assert.equal(shouldNotifyUpdate("abc", "def", "abc"), true);
});

test("hasStaffUserFlag matches the STAFF bit without requiring public flags", () => {
    assert.equal(hasStaffUserFlag(0), false);
    assert.equal(hasStaffUserFlag(1), true);
    assert.equal(hasStaffUserFlag(1n << 12n), false);
    assert.equal(hasStaffUserFlag((1n << 12n) | 1n), true);
});

test("summarizeCommitMessages formats human-readable commit subjects", () => {
    assert.equal(
        summarizeCommitMessages([
            { sha: "1", commit: { message: "Fix gateway reconnects\n\nBody" } },
            { sha: "2", commit: { message: "Document config option" } },
        ]),
        "- Fix gateway reconnects\n- Document config option",
    );

    assert.equal(
        summarizeCommitMessages(
            [
                { sha: "1", commit: { message: "One" } },
                { sha: "2", commit: { message: "Two" } },
                { sha: "3", commit: { message: "Three" } },
            ],
            2,
        ),
        "- One\n- Two\n- ...and 1 more commit.",
    );
});

test("buildUpdateNotificationMessage includes commits and compare link", () => {
    const message = buildUpdateNotificationMessage({
        repository: "spacebarchat/server",
        branch: "master",
        currentCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        latestCommit: {
            sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            commit: {
                committer: {
                    date: "2026-05-06T00:00:00Z",
                },
            },
        },
        compareUrl: "https://github.com/spacebarchat/server/compare/a...b",
        commits: [{ sha: "bbbbbbb", commit: { message: "Add update checker" } }],
    });

    assert.match(message.content, /new Spacebar server update is available/);
    assert.equal(message.embeds[0].title, "Spacebar update available");
    assert.match(message.embeds[0].description, /`aaaaaaa`/);
    assert.match(message.embeds[0].description, /`bbbbbbb`/);
    assert.match(message.embeds[0].fields[0].value, /Add update checker/);
    assert.equal(message.embeds[0].timestamp?.toISOString(), "2026-05-06T00:00:00.000Z");
});

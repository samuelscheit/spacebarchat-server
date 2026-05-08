"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..", "..");

function readRepoFile(...segments) {
    return fs.readFileSync(path.join(repoRoot, ...segments), "utf8");
}

function interfaceProperties(source, interfaceName) {
    const match = source.match(new RegExp(`export\\s+interface\\s+${interfaceName}\\s*{(?<body>[\\s\\S]*?)^}`, "m"));
    assert.ok(match?.groups?.body, `${interfaceName} interface must be present`);

    return [...match.groups.body.matchAll(/^ {4}([A-Za-z0-9_]+)\??:/gm)].map((property) => property[1]);
}

describe("post-data route contract", () => {
    test("hydrates forum post metadata without mutating read-state cursors", () => {
        const source = readRepoFile("src", "api", "routes", "channels", "#channel_id", "post-data.ts");

        assert.match(source, /requestBody:\s*"PostDataSchema"/);
        assert.match(source, /\(req\.body as PostDataSchema\)\.thread_ids/);
        assert.match(source, /\bChannel\.find\(/);
        assert.match(source, /\bMessage\.find\(/);
        assert.match(source, /\bMember\.find\(/);
        assert.match(source, /return res\.json\(objRet\)/);

        assert.doesNotMatch(source, /\bReadState\b/);
        assert.doesNotMatch(source, /\bapplyMessageAcknowledgeToReadState\b/);
        assert.doesNotMatch(source, /\bapplyAckBulkReadStateUpdate\b/);
        assert.doesNotMatch(source, /\bemitEvent\b/);
        assert.doesNotMatch(source, /advance-only notification cursor/);
    });

    test("keeps PostDataSchema limited to requested thread ids", () => {
        const source = readRepoFile("src", "schemas", "uncategorised", "PostDataSchema.ts");

        assert.deepEqual(interfaceProperties(source, "PostDataSchema"), ["thread_ids"]);
        assert.match(source, /^\s{4}thread_ids: string\[\];$/m);
    });
});

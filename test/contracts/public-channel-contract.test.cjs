"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { describe, test } = require("node:test");

function readJson(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function getSchemas(path) {
    const document = readJson(path);
    return document.components?.schemas ?? document;
}

describe("public channel generated contract", () => {
    test("does not expose stale channel nick schemas", () => {
        for (const path of ["assets/schemas.json", "assets/openapi.json"]) {
            const schemas = getSchemas(path);

            assert.ok(schemas.PublicChannel, `${path} defines PublicChannel`);
            assert.equal(Object.hasOwn(schemas, "ChannelNick"), false, `${path} should not define ChannelNick`);
            assert.equal(Object.hasOwn(schemas.PublicChannel.properties ?? {}, "nicks"), false, `${path} PublicChannel should not expose nicks`);
        }
    });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { normalizeMessageCreateSchema } from "./MessageCreateSchema";

const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));

describe("MessageCreateSchema", () => {
    test("does not expose server-inferred message type or deprecated singular embed", () => {
        const properties = schemas.MessageCreateSchema.properties;

        assert.equal("type" in properties, false);
        assert.equal("embed" in properties, false);
        assert.equal("embeds" in properties, true);
    });
});

describe("normalizeMessageCreateSchema", () => {
    test("moves deprecated singular embed into embeds and removes legacy type", () => {
        const embed = { title: "legacy" };
        const body = { content: "hello", type: 3, embed };

        const normalized = normalizeMessageCreateSchema(body);

        assert.equal("type" in normalized, false);
        assert.equal("embed" in normalized, false);
        assert.deepEqual(normalized.embeds, [embed]);
    });

    test("appends deprecated singular embed to existing embeds", () => {
        const first = { title: "first" };
        const second = { title: "second" };
        const body = { embeds: [first], embed: second };

        normalizeMessageCreateSchema(body);

        assert.deepEqual(body.embeds, [first, second]);
    });
});

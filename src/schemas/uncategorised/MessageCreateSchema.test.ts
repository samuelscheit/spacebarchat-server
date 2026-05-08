import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { normalizeMessageCreateSchema, type LegacyMessageCreateBody } from "./MessageCreateSchema";
import { ajv } from "../Validator";

const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));

describe("MessageCreateSchema", () => {
    test("does not expose server-inferred message type or deprecated singular embed", () => {
        const properties = schemas.MessageCreateSchema.properties;

        assert.equal("type" in properties, false);
        assert.equal("embed" in properties, false);
        assert.equal("embeds" in properties, true);
        assert.deepEqual(properties.poll, { $ref: "#/definitions/PollCreationSchema" });
    });

    test("uses creation-only poll answers", () => {
        const pollCreationSchema = schemas.PollCreationSchema;
        const pollCreationAnswerSchema = schemas.PollCreationAnswer;
        const pollSchema = schemas.Poll;

        assert.deepEqual(pollCreationSchema.properties.answers.items, { $ref: "#/definitions/PollCreationAnswer" });
        assert.equal("answer_id" in pollCreationAnswerSchema.properties, false);
        assert.deepEqual(pollSchema.properties.layout_type, { type: "integer" });
    });
});

describe("MessageEditSchema", () => {
    test("does not expose deprecated singular embed", () => {
        const properties = schemas.MessageEditSchema.properties;

        assert.equal("embed" in properties, false);
        assert.equal("embeds" in properties, true);
        assert.deepEqual(properties.poll, { $ref: "#/definitions/PollCreationSchema" });
    });
});

describe("normalizeMessageCreateSchema", () => {
    test("moves deprecated singular embed into embeds and removes legacy type", () => {
        const embed = { title: "legacy" };
        const body: LegacyMessageCreateBody = { content: "hello", type: 3, embed };

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

    test("preserves malformed embeds for schema validation when legacy embed is present", () => {
        const malformedEmbeds = {};
        const body = { embeds: malformedEmbeds, embed: { title: "legacy" } };

        assert.doesNotThrow(() => normalizeMessageCreateSchema(body));

        assert.equal("embed" in body, false);
        assert.equal(body.embeds, malformedEmbeds);
        assert.equal(ajv.validate("MessageCreateSchema", body), false);
        assert.equal(
            ajv.errors?.some((error) => error.instancePath === "/embeds"),
            true,
        );
    });

    test("leaves nullish pre-validation bodies for schema validation", () => {
        assert.doesNotThrow(() => normalizeMessageCreateSchema(null));
        assert.doesNotThrow(() => normalizeMessageCreateSchema(undefined));
        assert.equal(normalizeMessageCreateSchema(null), null);
        assert.equal(normalizeMessageCreateSchema(undefined), undefined);
    });
});

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const interactionSchema = {
    ...(schemas.InteractionSchema as Record<string, unknown>),
    definitions: schemas,
};

function compileInteractionSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(interactionSchema);
}

function baseInteraction() {
    return {
        application_id: "100000000000000001",
        channel_id: "100000000000000002",
    };
}

describe("InteractionSchema", () => {
    test("accepts ping interactions without data", () => {
        const validate = compileInteractionSchema();

        assert.equal(validate({ ...baseInteraction(), type: 1 }), true, JSON.stringify(validate.errors));
    });

    test("accepts typed interaction data variants", () => {
        const validate = compileInteractionSchema();

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 2,
                data: {
                    id: "100000000000000003",
                    name: "ping",
                    version: "100000000000000004",
                },
            }),
            true,
            JSON.stringify(validate.errors),
        );

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 4,
                data: {
                    id: "100000000000000006",
                    name: "autocomplete",
                    version: "100000000000000007",
                },
            }),
            true,
            JSON.stringify(validate.errors),
        );

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 3,
                message_id: "100000000000000008",
                data: {
                    custom_id: "confirm",
                    component_type: 2,
                },
            }),
            true,
            JSON.stringify(validate.errors),
        );

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 5,
                data: {
                    id: "100000000000000005",
                    custom_id: "feedback",
                },
            }),
            true,
            JSON.stringify(validate.errors),
        );
    });

    test("rejects non-Discord root files field and untyped data", () => {
        const validate = compileInteractionSchema();

        assert.equal(validate({ ...baseInteraction(), type: 1, files: [] }), false);
        assert.equal(
            validate({
                ...baseInteraction(),
                type: 1,
                data: {
                    id: "100000000000000010",
                    name: "ping",
                    version: "100000000000000011",
                },
            }),
            false,
        );
        assert.equal(validate({ ...baseInteraction(), type: 2, data: {} }), false);
    });

    test("rejects data payloads that do not match the interaction type", () => {
        const validate = compileInteractionSchema();

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 2,
                data: {
                    custom_id: "confirm",
                    component_type: 2,
                },
            }),
            false,
        );

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 3,
                message_id: "100000000000000012",
                data: {
                    id: "100000000000000013",
                    name: "ping",
                    version: "100000000000000014",
                },
            }),
            false,
        );

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 5,
                data: {
                    custom_id: "confirm",
                    component_type: 2,
                },
            }),
            false,
        );
    });

    test("requires data for non-ping interactions", () => {
        const validate = compileInteractionSchema();

        assert.equal(validate({ ...baseInteraction(), type: 2 }), false);
        assert.equal(validate({ ...baseInteraction(), type: 3, message_id: "100000000000000009" }), false);
        assert.equal(validate({ ...baseInteraction(), type: 4 }), false);
        assert.equal(validate({ ...baseInteraction(), type: 5 }), false);
    });

    test("requires message_id for message component interactions", () => {
        const validate = compileInteractionSchema();

        assert.equal(
            validate({
                ...baseInteraction(),
                type: 3,
                data: {
                    custom_id: "confirm",
                    component_type: 2,
                },
            }),
            false,
        );
    });
});

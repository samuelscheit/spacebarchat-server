import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ajv } from "../Validator";

function validate(schema: string, data: unknown) {
    const validator = ajv.getSchema(schema);
    assert.ok(validator, `${schema} is registered`);
    const valid = validator(data);
    return { valid, errors: validator.errors };
}

function hasAdditionalPropertyError(errors: typeof ajv.errors, property: string) {
    return errors?.some((error) => error.keyword === "additionalProperties" && (error.params as { additionalProperty?: string }).additionalProperty === property) ?? false;
}

describe("channel status schemas", () => {
    test("channel create rejects status", () => {
        const { valid, errors } = validate("ChannelCreateSchema", {
            name: "general",
            type: 0,
            status: "should not be accepted on create",
        });

        assert.equal(valid, false);
        assert.equal(hasAdditionalPropertyError(errors, "status"), true);
    });

    test("guild create rejects nested channel status", () => {
        const { valid, errors } = validate("GuildCreateSchema", {
            name: "guild",
            channels: [
                {
                    id: "01",
                    name: "general",
                    type: 0,
                    status: "should not be accepted on nested create",
                },
            ],
        });

        assert.equal(valid, false);
        assert.equal(hasAdditionalPropertyError(errors, "status"), true);
    });

    test("channel modify accepts bounded status", () => {
        assert.equal(validate("ChannelModifySchema", { status: "Daily standup" }).valid, true);
        assert.equal(validate("ChannelModifySchema", { status: null }).valid, true);
        assert.equal(validate("ChannelModifySchema", { status: "x".repeat(501) }).valid, false);
    });
});

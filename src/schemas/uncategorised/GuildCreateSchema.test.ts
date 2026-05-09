import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ajv } from "../Validator";

function validate(schema: string, data: unknown) {
    const validator = ajv.getSchema(schema);
    assert.ok(validator, `${schema} is registered`);
    const valid = validator(data);
    return { valid, errors: validator.errors };
}

describe("GuildCreateSchema", () => {
    test("accepts nullable safety alerts channel references", () => {
        assert.equal(validate("GuildCreateSchema", { name: "guild", safety_alerts_channel_id: "client-safety" }).valid, true);
        assert.equal(validate("GuildCreateSchema", { name: "guild", safety_alerts_channel_id: null }).valid, true);
    });

    test("rejects non-scalar safety alerts channel references", () => {
        const { valid, errors } = validate("GuildCreateSchema", { name: "guild", safety_alerts_channel_id: {} });

        assert.equal(valid, false);
        assert.equal(errors?.[0]?.instancePath, "/safety_alerts_channel_id");
    });
});

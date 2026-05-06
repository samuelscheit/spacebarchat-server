import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

describe("ChannelModifySchema", () => {
    const validate = ajv.getSchema("ChannelModifySchema");

    test("keeps parent_id null when removing a channel from a category", () => {
        assert(validate, "ChannelModifySchema must be registered");

        const payload = { parent_id: null };
        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
        assert.equal(payload.parent_id, null);
    });

    test("allows string parent_id values", () => {
        assert(validate, "ChannelModifySchema must be registered");

        const payload = { parent_id: "123" };
        assert.equal(validate(payload), true, JSON.stringify(validate.errors));
        assert.equal(payload.parent_id, "123");
    });
});

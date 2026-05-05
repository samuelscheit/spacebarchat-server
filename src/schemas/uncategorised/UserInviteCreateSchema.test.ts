import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

describe("UserInviteCreateSchema", () => {
    test("accepts an empty body or a custom invite code", () => {
        const validate = ajv.getSchema("UserInviteCreateSchema");
        assert.ok(validate);

        assert.equal(validate({}), true);
        assert.equal(validate({ code: "friend1" }), true);
    });

    test("rejects channel invite options", () => {
        const validate = ajv.getSchema("UserInviteCreateSchema");
        assert.ok(validate);

        assert.equal(validate({ max_age: 60 }), false);
    });
});

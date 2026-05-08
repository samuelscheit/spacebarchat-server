import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ajv, nonCoercingAjv } from "../Validator";

describe("ConnectionUpdateSchema", () => {
    const validate = ajv.getSchema("ConnectionUpdateSchema");

    test("is registered for route request validation", () => {
        assert.ok(validate);
    });

    test("accepts connection visibility settings", () => {
        assert.equal(
            validate?.({
                visibility: true,
                show_activity: false,
                metadata_visibility: true,
            }),
            true,
        );
    });

    test("rejects unknown connection update fields", () => {
        assert.equal(validate?.({ visibility: true, friend_sync: true }), false);
    });

    test("rejects non-boolean connection update fields", () => {
        assert.equal(nonCoercingAjv.validate("ConnectionUpdateSchema", { visibility: 1 }), false);
    });
});

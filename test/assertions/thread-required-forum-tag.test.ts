import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertRequiredAppliedTagsPresent } from "../../src/api/util/ChannelAppliedTagsValidation";
import { FieldError } from "../../src/util/util/FieldError";

describe("assertRequiredAppliedTagsPresent", () => {
    test("rejects missing applied_tags when the parent channel requires tags", () => {
        assert.throws(
            () => assertRequiredAppliedTagsPresent(undefined, true),
            (error: unknown) => {
                assert.ok(error instanceof FieldError);
                assert.equal(error.code, 50035);
                assert.equal(error.message, "Invalid Form Body");
                assert.deepEqual(error.errors, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_REQUIRED",
                                message: "This field is required",
                            },
                        ],
                    },
                });
                return true;
            },
        );
    });

    test("rejects an empty applied_tags array when the parent channel requires tags", () => {
        assert.throws(
            () => assertRequiredAppliedTagsPresent([], true),
            (error: unknown) => {
                assert.ok(error instanceof FieldError);
                assert.equal(error.code, 50035);
                assert.ok(error.errors?.applied_tags);
                return true;
            },
        );
    });

    test("allows omitted applied_tags when tags are not required", () => {
        assert.doesNotThrow(() => assertRequiredAppliedTagsPresent(undefined, false));
    });

    test("allows non-empty applied_tags when tags are required", () => {
        assert.doesNotThrow(() => assertRequiredAppliedTagsPresent(["123"], true));
    });
});

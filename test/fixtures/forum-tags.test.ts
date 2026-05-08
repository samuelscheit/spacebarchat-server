import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FieldError } from "@spacebar/util";
import { assertAppliedTagsExist, assertRequiredAppliedTags } from "../../src/api/util/utility/ForumTags";

function assertFieldError(error: unknown, expected: Record<string, { _errors: Array<{ code: string; message: string }> }>) {
    assert.ok(error instanceof FieldError);
    assert.equal(error.code, 50035);
    assert.equal(error.message, "Invalid Form Body");
    assert.deepEqual(error.errors, expected);
    return true;
}

describe("forum applied tag validation", () => {
    test("accepts applied tags that exist on the parent channel", () => {
        assert.doesNotThrow(() => assertAppliedTagsExist(["tag-1", "tag-2"], [{ id: "tag-1" }, { id: "tag-2" }]));
    });

    test("accepts present applied tags when a parent requires at least one tag", () => {
        assert.doesNotThrow(() => assertRequiredAppliedTags(["tag-1"]));
    });

    test("rejects an applied tag that is not available on the parent channel as a form body error", () => {
        assert.throws(
            () => assertAppliedTagsExist(["tag-1", "missing-tag"], [{ id: "tag-1" }]),
            (error) =>
                assertFieldError(error, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_CHOICES",
                                message: "Tag missing-tag is not available for this channel",
                            },
                        ],
                    },
                }),
        );
    });

    test("rejects applied tags when the parent channel has no available tags", () => {
        assert.throws(
            () => assertAppliedTagsExist(["missing-tag"], []),
            (error) =>
                assertFieldError(error, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_CHOICES",
                                message: "Tag missing-tag is not available for this channel",
                            },
                        ],
                    },
                }),
        );
    });

    test("rejects applied tags when available tags were not loaded", () => {
        assert.throws(
            () => assertAppliedTagsExist(["missing-tag"], undefined),
            (error) =>
                assertFieldError(error, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_CHOICES",
                                message: "Tag missing-tag is not available for this channel",
                            },
                        ],
                    },
                }),
        );
    });

    test("rejects missing applied tags when the parent channel requires a tag", () => {
        assert.throws(
            () => assertRequiredAppliedTags(undefined),
            (error) =>
                assertFieldError(error, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_REQUIRED",
                                message: "This field is required",
                            },
                        ],
                    },
                }),
        );
    });

    test("rejects empty applied tags when the parent channel requires a tag", () => {
        assert.throws(
            () => assertRequiredAppliedTags([]),
            (error) =>
                assertFieldError(error, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_REQUIRED",
                                message: "This field is required",
                            },
                        ],
                    },
                }),
        );
    });
});

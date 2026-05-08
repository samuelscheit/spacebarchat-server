import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FieldError } from "@spacebar/util";
import { assertAppliedTagsExist } from "./ForumTags";

describe("forum applied tag validation", () => {
    test("accepts applied tags that exist on the parent channel", () => {
        assert.doesNotThrow(() => assertAppliedTagsExist(["tag-1", "tag-2"], [{ id: "tag-1" }, { id: "tag-2" }]));
    });

    test("rejects an applied tag that is not available on the parent channel as a form body error", () => {
        assert.throws(
            () => assertAppliedTagsExist(["tag-1", "missing-tag"], [{ id: "tag-1" }]),
            (error) => {
                assert.ok(error instanceof FieldError);
                assert.equal(error.code, 50035);
                assert.equal(error.message, "Invalid Form Body");
                assert.deepEqual(error.errors, {
                    applied_tags: {
                        _errors: [
                            {
                                code: "BASE_TYPE_CHOICES",
                                message: "Tag missing-tag is not available for this channel",
                            },
                        ],
                    },
                });
                return true;
            },
        );
    });
});

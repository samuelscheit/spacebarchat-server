import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ErrorList, ObjectErrorContent } from "@spacebar/util";
import { addInvalidAppliedTagsError } from "./ChannelModifyAppliedTags";

describe("channel modify applied tag validation", () => {
    test("rejects non-thread applied_tags instead of silently dropping them", () => {
        const errors: ErrorList = {};
        const payload = { applied_tags: ["tag-a"] };

        addInvalidAppliedTagsError(payload, false, errors);

        assert.deepEqual(errors, {
            applied_tags: {
                _errors: [
                    {
                        code: "BASE_TYPE_BAD_VALUE",
                        message: "Applied tags can only be set on threads",
                    },
                ],
            },
        });
        assert.deepEqual(payload.applied_tags, ["tag-a"]);
    });

    test("rejects an empty non-thread applied_tags array because the field is still invalid", () => {
        const errors: ErrorList = {};

        addInvalidAppliedTagsError({ applied_tags: [] }, false, errors);

        const appliedTagsError = errors.applied_tags as ObjectErrorContent | undefined;
        assert.equal(appliedTagsError?._errors[0]?.code, "BASE_TYPE_BAD_VALUE");
    });

    test("allows thread applied_tags and omitted applied_tags", () => {
        const threadErrors: ErrorList = {};
        const omittedErrors: ErrorList = {};

        addInvalidAppliedTagsError({ applied_tags: ["tag-a"] }, true, threadErrors);
        addInvalidAppliedTagsError({}, false, omittedErrors);

        assert.deepEqual(threadErrors, {});
        assert.deepEqual(omittedErrors, {});
    });
});

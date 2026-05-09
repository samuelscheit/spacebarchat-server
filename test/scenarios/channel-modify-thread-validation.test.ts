import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addThreadChannelModifyFieldErrors, createThreadPermissionOverwriteFieldErrors, validateThreadAppliedTags } from "../../src/api/util/ChannelModifyThreadValidation";

describe("addThreadChannelModifyFieldErrors", () => {
    test("reports permission_overwrites as a field validation error for threads", () => {
        const errors = {};

        addThreadChannelModifyFieldErrors(
            errors,
            {
                permission_overwrites: [],
            },
            true,
        );

        assert.deepEqual(errors, {
            permission_overwrites: {
                _errors: [
                    {
                        code: "BASE_TYPE_BAD_VALUE",
                        message: "Threads cannot update permission_overwrites",
                    },
                ],
            },
        });
    });

    test("does not reject permission_overwrites for non-thread channels", () => {
        const errors = {};

        addThreadChannelModifyFieldErrors(
            errors,
            {
                permission_overwrites: [],
            },
            false,
        );

        assert.deepEqual(errors, {});
    });

    test("keeps existing thread channel-order validation in the same error bucket", () => {
        const errors = {};

        addThreadChannelModifyFieldErrors(
            errors,
            {
                permission_overwrites: [],
                position: 0,
                parent_id: "category",
            },
            true,
        );

        assert.deepEqual(Object.keys(errors), ["permission_overwrites", "position", "parent_id"]);
    });

    test("creates the shared thread permission overwrite route error", () => {
        assert.deepEqual(createThreadPermissionOverwriteFieldErrors(), {
            permission_overwrites: {
                _errors: [
                    {
                        code: "BASE_TYPE_BAD_VALUE",
                        message: "Threads cannot update permission_overwrites",
                    },
                ],
            },
        });
    });
});

describe("validateThreadAppliedTags", () => {
    test("reports invalid applied tags as field validation errors", () => {
        const errors = {};

        const result = validateThreadAppliedTags(errors, ["unknown-tag"], ["existing-tag"], [{ id: "existing-tag", moderated: false }]);

        assert.deepEqual(result, { shouldApply: false, requiresManageThreads: false });
        assert.deepEqual(errors, {
            applied_tags: {
                _errors: [
                    {
                        code: "BASE_TYPE_BAD_VALUE",
                        message: "Invalid tag unknown-tag",
                    },
                ],
            },
        });
    });

    test("requires manage threads when a moderated applied tag changes", () => {
        const errors = {};

        const result = validateThreadAppliedTags(errors, ["moderated-tag"], [], [{ id: "moderated-tag", moderated: true }]);

        assert.deepEqual(errors, {});
        assert.deepEqual(result, { shouldApply: true, requiresManageThreads: true });
    });

    test("allows empty applied tag updates without available tags", () => {
        const errors = {};

        const result = validateThreadAppliedTags(errors, [], ["old-tag"], undefined);

        assert.deepEqual(errors, {});
        assert.deepEqual(result, { shouldApply: true, requiresManageThreads: false });
    });
});

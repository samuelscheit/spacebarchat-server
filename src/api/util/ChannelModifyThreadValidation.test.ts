import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addThreadChannelModifyFieldErrors } from "./ChannelModifyThreadValidation";

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
});

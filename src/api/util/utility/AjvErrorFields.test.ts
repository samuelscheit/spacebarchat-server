import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ErrorObject } from "ajv";
import { ajvErrorsToFieldErrors } from "./AjvErrorFields";

describe("AJV field error formatting", () => {
    test("maps root required-property errors to the missing field name", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "",
                    keyword: "required",
                    message: "must have required property 'username'",
                    params: { missingProperty: "username" },
                    schemaPath: "#/required",
                } as ErrorObject,
                {
                    instancePath: "",
                    keyword: "required",
                    message: "must have required property 'discriminator'",
                    params: { missingProperty: "discriminator" },
                    schemaPath: "#/required",
                } as ErrorObject,
            ]),
            {
                username: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "This field is required",
                        },
                    ],
                },
                discriminator: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "This field is required",
                        },
                    ],
                },
            },
        );
    });

    test("maps nested required-property errors below their object path", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "/metadata",
                    keyword: "required",
                    message: "must have required property 'reason'",
                    params: { missingProperty: "reason" },
                    schemaPath: "#/properties/metadata/required",
                } as ErrorObject,
            ]),
            {
                metadata: {
                    reason: {
                        _errors: [
                            {
                                code: "BASE_TYPE_REQUIRED",
                                message: "This field is required",
                            },
                        ],
                    },
                },
            },
        );
    });

    test("keeps direct field validation errors on their instance path", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "/username",
                    keyword: "type",
                    message: "must be string",
                    params: { type: "string" },
                    schemaPath: "#/properties/username/type",
                } as ErrorObject,
            ]),
            {
                username: {
                    _errors: [
                        {
                            code: "BASE_TYPE_INVALID",
                            message: "must be string",
                        },
                    ],
                },
            },
        );
    });
});

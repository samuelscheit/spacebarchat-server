import assert from "node:assert/strict";
import { describe, test } from "node:test";
import Ajv, { type ErrorObject } from "ajv";
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

    test("derives nested required fields from actual AJV errors", () => {
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile({
            type: "object",
            required: ["username", "profile", "items"],
            properties: {
                username: { type: "string" },
                profile: {
                    type: "object",
                    required: ["display_name"],
                    properties: {
                        display_name: { type: "string" },
                    },
                },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["id"],
                        properties: {
                            id: { type: "string" },
                        },
                    },
                },
            },
        });

        assert.equal(validate({ profile: {}, items: [{}] }), false);
        assert.deepEqual(ajvErrorsToFieldErrors(validate.errors ?? []), {
            username: {
                _errors: [
                    {
                        code: "BASE_TYPE_REQUIRED",
                        message: "This field is required",
                    },
                ],
            },
            profile: {
                display_name: {
                    _errors: [
                        {
                            code: "BASE_TYPE_REQUIRED",
                            message: "This field is required",
                        },
                    ],
                },
            },
            items: {
                "0": {
                    id: {
                        _errors: [
                            {
                                code: "BASE_TYPE_REQUIRED",
                                message: "This field is required",
                            },
                        ],
                    },
                },
            },
        });
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

    test("maps additional property errors to the unexpected field", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "/metadata",
                    keyword: "additionalProperties",
                    message: "must NOT have additional properties",
                    params: { additionalProperty: "unexpected" },
                    schemaPath: "#/properties/metadata/additionalProperties",
                } as ErrorObject,
            ]),
            {
                metadata: {
                    unexpected: {
                        _errors: [
                            {
                                code: "additionalProperties",
                                message: "must NOT have additional properties",
                            },
                        ],
                    },
                },
            },
        );
    });

    test("decodes JSON pointer segments and keeps array indices in field paths", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "/items/0/weird~1name~0key",
                    keyword: "minLength",
                    message: "must NOT have fewer than 2 characters",
                    params: { limit: 2 },
                    schemaPath: "#/properties/items/items/properties/weird~1name~0key/minLength",
                } as ErrorObject,
            ]),
            {
                items: {
                    "0": {
                        "weird/name~key": {
                            _errors: [
                                {
                                    code: "BASE_TYPE_BAD_LENGTH",
                                    message: "must NOT have fewer than 2 characters",
                                },
                            ],
                        },
                    },
                },
            },
        );
    });

    test("appends multiple validation errors on the same field", () => {
        assert.deepEqual(
            ajvErrorsToFieldErrors([
                {
                    instancePath: "/username",
                    keyword: "type",
                    message: "must be string",
                    params: { type: "string" },
                    schemaPath: "#/properties/username/type",
                } as ErrorObject,
                {
                    instancePath: "/username",
                    keyword: "minLength",
                    message: "must NOT have fewer than 2 characters",
                    params: { limit: 2 },
                    schemaPath: "#/properties/username/minLength",
                } as ErrorObject,
            ]),
            {
                username: {
                    _errors: [
                        {
                            code: "BASE_TYPE_INVALID",
                            message: "must be string",
                        },
                        {
                            code: "BASE_TYPE_BAD_LENGTH",
                            message: "must NOT have fewer than 2 characters",
                        },
                    ],
                },
            },
        );
    });
});

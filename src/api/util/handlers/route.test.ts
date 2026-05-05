import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ErrorObject } from "ajv";
import { getValidationErrorField } from "./ValidationErrors";

describe("getValidationErrorField", () => {
    test("uses missing property for root required errors", () => {
        const error = {
            instancePath: "",
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "username" },
        } as ErrorObject;

        assert.equal(getValidationErrorField(error), "username");
    });

    test("appends missing property to nested required errors", () => {
        const error = {
            instancePath: "/profile",
            schemaPath: "#/properties/profile/required",
            keyword: "required",
            params: { missingProperty: "display_name" },
        } as ErrorObject;

        assert.equal(getValidationErrorField(error), "profile/display_name");
    });

    test("keeps non-required errors on their instance path", () => {
        const error = {
            instancePath: "/username",
            schemaPath: "#/properties/username/minLength",
            keyword: "minLength",
            params: {},
        } as ErrorObject;

        assert.equal(getValidationErrorField(error), "username");
    });

    test("unescapes JSON pointer path segments", () => {
        const error = {
            instancePath: "/metadata/foo~1bar/~0key",
            schemaPath: "#/properties/metadata/properties/foo~1bar/properties/~0key/type",
            keyword: "type",
            params: {},
        } as ErrorObject;

        assert.equal(getValidationErrorField(error), "metadata/foo/bar/~key");
    });

    test("unescapes parent path for required errors", () => {
        const error = {
            instancePath: "/metadata/foo~1bar",
            schemaPath: "#/properties/metadata/properties/foo~1bar/required",
            keyword: "required",
            params: { missingProperty: "name" },
        } as ErrorObject;

        assert.equal(getValidationErrorField(error), "metadata/foo/bar/name");
    });
});

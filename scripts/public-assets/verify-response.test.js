"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { parseVerificationResponse } = require("../../assets/public/verify-response.js");

describe("public verify response parser", () => {
    test("treats 204 No Content as a successful response without parsing JSON", async () => {
        let jsonCalled = false;
        const parsed = await parseVerificationResponse({
            status: 204,
            json: async () => {
                jsonCalled = true;
                throw new Error("204 responses must not be parsed as JSON");
            },
        });

        assert.equal(parsed, null);
        assert.equal(jsonCalled, false);
    });

    test("parses non-204 JSON error responses", async () => {
        const errorResponse = {
            message: "Invalid Form Body",
            code: 50035,
            errors: {
                token: {
                    _errors: [
                        {
                            code: "INVALID_TOKEN",
                            message: "Invalid token",
                        },
                    ],
                },
            },
        };

        const parsed = await parseVerificationResponse({
            status: 400,
            json: async () => errorResponse,
        });

        assert.deepEqual(parsed, errorResponse);
    });
});

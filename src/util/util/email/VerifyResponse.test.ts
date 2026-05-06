import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const verifyResponsePath = path.resolve(__dirname, "../../../../assets/public/verify-response.js");

async function loadParser() {
    const module = await import(pathToFileURL(verifyResponsePath).href);
    return (module.parseVerificationResponse ?? module.default.parseVerificationResponse) as (response: { status: number; json: () => Promise<unknown> }) => Promise<unknown>;
}

describe("verify page response parser", () => {
    test("treats 204 verification responses as success without parsing JSON", async () => {
        const parseVerificationResponse = await loadParser();

        let parsedJson = false;
        const data = await parseVerificationResponse({
            status: 204,
            json() {
                parsedJson = true;
                return Promise.resolve({});
            },
        });

        assert.equal(data, null);
        assert.equal(parsedJson, false);
    });

    test("parses JSON bodies for non-204 verification responses", async () => {
        const parseVerificationResponse = await loadParser();
        const expected = { message: "Invalid token" };

        const data = await parseVerificationResponse({
            status: 400,
            json() {
                return Promise.resolve(expected);
            },
        });

        assert.deepEqual(data, expected);
    });
});

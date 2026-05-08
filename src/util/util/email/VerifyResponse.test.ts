import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const verifyPagePath = path.resolve(__dirname, "../../../../assets/public/verify.html");
const verifyResponsePath = path.resolve(__dirname, "../../../../assets/public/verify-response.js");

async function loadParser() {
    const module = await import(pathToFileURL(verifyResponsePath).href);
    return (module.parseVerificationResponse ?? module.default.parseVerificationResponse) as (response: { status: number; json: () => Promise<unknown> }) => Promise<unknown>;
}

describe("verify page response parser", () => {
    test("verify page loads the parser helper and treats 204 success sentinel as verified", async () => {
        const verifyPage = await fs.readFile(verifyPagePath, "utf-8");

        assert.match(verifyPage, /<script src="\/verify-response\.js"><\/script>/);
        assert.match(verifyPage, /parseVerificationResponse\(response\)/);
        assert.match(verifyPage, /if \(data === null\) {\s+title\.innerText = "Email Verified";\s+subtitle\.innerText = "You can now login\.";\s+return;\s+}/);
    });

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

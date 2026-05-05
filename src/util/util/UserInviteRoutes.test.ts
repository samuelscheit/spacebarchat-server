import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

type OpenApiDocument = {
    paths: Record<string, Record<string, unknown>>;
};

describe("user invite route metadata", () => {
    test("declares the create user invite route", () => {
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8")) as OpenApiDocument;

        assert.deepEqual(Object.keys(openapi.paths["/users/@me/invites/"]).sort(), ["post"]);
    });
});

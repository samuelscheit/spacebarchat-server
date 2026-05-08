import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("GET /users/:user_id/messages response schema", () => {
    it("advertises the DM partial-message schema and hydrates authors", () => {
        const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "#user_id", "messages.ts"), "utf-8");

        assert.match(routeSource, /body:\s*"DmMessagesResponseSchema"/);
        assert.match(routeSource, /if\s*\(!channel\)\s*return\s+res\.status\(200\)\.send\(\[\]\s+satisfies\s+DmMessagesResponseSchema\)/);
        assert.doesNotMatch(routeSource, /channel_id:\s*channel\?\.id/);
        assert.match(routeSource, /relations:\s*{\s*author:\s*true\s*}/);
        assert.match(routeSource, /\.toPartialMessage\(\)/);
    });

    it("keeps DM message preloads constrained to the PartialMessage contract", () => {
        const schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8"));
        const partialMessage = schemas.PartialMessage;

        assert.deepEqual(schemas.DmMessagesResponseSchema.items, { $ref: "#/definitions/PartialMessage" });
        assert.equal(Object.hasOwn(partialMessage.properties, "recipient_id"), false);
        assert.equal(partialMessage.additionalProperties, false);
    });
});

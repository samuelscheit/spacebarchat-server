import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("GET /users/@me/mentions response schema", () => {
    it("should reuse the shared message array schema", () => {
        const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "mentions.ts"), "utf-8");

        assert.match(routeSource, /body:\s*"APIMessageArray"/);
        assert.doesNotMatch(routeSource, /body:\s*"MessageListResponse"/);
    });

    it("should emit an OpenAPI response reference that resolves to a generated schema", () => {
        const openapi = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf-8"));
        const schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf-8"));

        const responseSchema = openapi.paths["/users/@me/mentions"].get.responses["200"].content["application/json"].schema;

        assert.deepEqual(responseSchema, { $ref: "#/components/schemas/APIMessageArray" });
        assert.ok(schemas.APIMessageArray, "APIMessageArray must be present in generated schemas");
    });
});

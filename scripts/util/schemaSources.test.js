const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { getGeneratedSchemaSources, isGeneratedSchemaSource } = require("./schemaSources");

test("generated schema sources exclude test files", () => {
    assert.equal(isGeneratedSchemaSource(path.join("src", "schemas", "responses", "TypedResponses.ts")), true);
    assert.equal(isGeneratedSchemaSource(path.join("src", "schemas", "responses", "TypedResponses.test.ts")), false);
    assert.equal(isGeneratedSchemaSource(path.join("src", "schemas", "responses", "__tests__", "Helper.ts")), false);
});

test("generated schema source collection filters walked test files", () => {
    const root = path.join("src", "schemas");
    const files = getGeneratedSchemaSources(root, () => [
        path.join(root, "responses", "TypedResponses.ts"),
        path.join(root, "responses", "TypedResponses.test.ts"),
        path.join(root, "api", "users", "Member.ts"),
    ]);

    assert.deepEqual(files, [path.join(root, "responses", "TypedResponses.ts"), path.join(root, "api", "users", "Member.ts")]);
});

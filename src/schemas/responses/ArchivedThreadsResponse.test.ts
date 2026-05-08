import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

test("ArchivedThreadsResponse is generated and used by the public archived threads route", () => {
    const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
    const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
        components: { schemas: Record<string, JsonShape> };
        paths: Record<string, { get?: { responses?: Record<string, { content?: { "application/json"?: { schema?: JsonShape } } }> } }>;
    };

    assert.equal(schemas.ArchivedThreadsResponse.properties?.threads?.items?.$ref, "#/definitions/ActiveThreadsChannel");
    assert.equal(schemas.ArchivedThreadsResponse.properties?.members?.items?.$ref, "#/definitions/ActiveThreadsThreadMember");
    assert.equal(schemas.ArchivedThreadsResponse.properties?.has_more?.type, "boolean");
    assert.ok(openapi.components.schemas.ArchivedThreadsResponse, "OpenAPI should include ArchivedThreadsResponse");
    assert.equal(
        openapi.paths["/channels/{channel_id}/threads/archived/public/"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
        "#/components/schemas/ArchivedThreadsResponse",
    );
});

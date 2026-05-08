import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

type SchemaObject = {
    $ref?: string;
    type?: string;
    items?: SchemaObject;
    properties?: Record<string, SchemaObject>;
};

function readJson(path: string) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function schemaNameFromRef(ref: string) {
    return ref.replace("#/components/schemas/", "").replace("#/definitions/", "");
}

function resolveOpenApi(openapi: { components: { schemas: Record<string, SchemaObject> } }, schema: SchemaObject): SchemaObject {
    let resolved = schema;
    while (resolved.$ref) resolved = openapi.components.schemas[schemaNameFromRef(resolved.$ref)];
    return resolved;
}

function resolveAssetSchema(schemas: Record<string, SchemaObject>, schema: SchemaObject): SchemaObject {
    let resolved = schema;
    while (resolved.$ref) resolved = schemas[schemaNameFromRef(resolved.$ref)];
    return resolved;
}

function collectRefs(value: unknown, refs: string[] = []) {
    if (!value || typeof value !== "object") return refs;
    if ("$ref" in value && typeof value.$ref === "string") refs.push(value.$ref);
    for (const child of Object.values(value)) collectRefs(child, refs);
    return refs;
}

describe("public message generated contract", () => {
    test("OpenAPI documents message member roles as role id strings", () => {
        const openapi = readJson("assets/openapi.json");
        const publicMessage = resolveOpenApi(openapi, openapi.components.schemas.APIPublicMessage);
        const member = resolveOpenApi(openapi, publicMessage.properties!.member!);
        const roles = resolveOpenApi(openapi, member.properties!.roles!);

        assert.equal(roles.type, "array");
        assert.equal(resolveOpenApi(openapi, roles.items!).type, "string");
    });

    test("validation schemas document message member roles as role id strings", () => {
        const schemas = readJson("assets/schemas.json");
        const publicMessage = resolveAssetSchema(schemas, schemas.APIPublicMessage);
        const member = resolveAssetSchema(schemas, publicMessage.properties!.member!);
        const roles = resolveAssetSchema(schemas, member.properties!.roles!);

        assert.equal(roles.type, "array");
        assert.equal(resolveAssetSchema(schemas, roles.items!).type, "string");
    });

    test("public message route responses do not point at the internal Message entity schema", () => {
        const openapi = readJson("assets/openapi.json");
        const pathRefs = collectRefs(openapi.paths);

        assert.deepEqual(
            pathRefs.filter((ref) => ref === "#/components/schemas/Message"),
            [],
        );
    });

    test("APIMessageArray is an array of public messages", () => {
        const schemas = readJson("assets/schemas.json");
        const apiMessageArray = resolveAssetSchema(schemas, schemas.APIMessageArray);
        const item = resolveAssetSchema(schemas, apiMessageArray.items!);

        assert.equal(apiMessageArray.type, "array");
        assert.equal(apiMessageArray.items?.$ref, "#/definitions/PublicMessage");
        assert.ok(item.properties?.member, "APIMessageArray items should expose the public message schema");
    });
});

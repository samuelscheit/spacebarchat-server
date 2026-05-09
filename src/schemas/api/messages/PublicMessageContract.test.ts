import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

type SchemaObject = {
    $ref?: string;
    type?: string;
    items?: SchemaObject;
    properties?: Record<string, SchemaObject>;
    additionalProperties?: SchemaObject | boolean;
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

function assertStickerResponseArray(schema: SchemaObject, resolveSchema: (schema: SchemaObject) => SchemaObject, expectedRef: string) {
    const stickers = resolveSchema(schema);
    const sticker = resolveSchema(stickers.items!);

    assert.equal(stickers.type, "array");
    assert.equal(stickers.items?.$ref, expectedRef);
    assert.equal(sticker.properties?.id?.type, "string");
    assert.equal(sticker.properties?.name?.type, "string");
    assert.equal(sticker.properties?.pack, undefined);
    assert.equal(sticker.properties?.guild, undefined);
    assert.equal(sticker.properties?.user_id, undefined);
}

function assertMessageStickerFields(schema: SchemaObject, resolveSchema: (schema: SchemaObject) => SchemaObject, expectedRef: string) {
    const message = resolveSchema(schema);

    assertStickerResponseArray(message.properties!.sticker_items!, resolveSchema, expectedRef);
    assertStickerResponseArray(message.properties!.stickers!, resolveSchema, expectedRef);
}

function expectResolvedMapRefs(resolved: SchemaObject, expectedRefs: Record<string, string>) {
    assert.deepEqual(Object.keys(resolved.properties ?? {}).sort(), Object.keys(expectedRefs).sort());
    for (const [name, property] of Object.entries(resolved.properties ?? {})) {
        assert.equal(property.type, "object");
        assert.notEqual(property.additionalProperties, false);
        assert.equal((property.additionalProperties as SchemaObject).$ref, expectedRefs[name]);
    }
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

    test("PublicMessage documents resolved interaction resource maps", () => {
        const schemas = readJson("assets/schemas.json");
        const publicMessage = resolveAssetSchema(schemas, schemas.PublicMessage);
        const resolved = resolveAssetSchema(schemas, publicMessage.properties!.resolved!);
        expectResolvedMapRefs(resolved, {
            attachments: "#/definitions/PublicAttachment",
            channels: "#/definitions/ResolvedChannel",
            members: "#/definitions/ResolvedGuildMember",
            messages: "#/definitions/PartialMessage",
            roles: "#/definitions/PublicRole",
            users: "#/definitions/PartialUser",
        });
    });

    test("OpenAPI documents resolved interaction resource maps", () => {
        const openapi = readJson("assets/openapi.json");
        const publicMessage = resolveOpenApi(openapi, openapi.components.schemas.PublicMessage);
        const resolved = resolveOpenApi(openapi, publicMessage.properties!.resolved!);
        expectResolvedMapRefs(resolved, {
            attachments: "#/components/schemas/PublicAttachment",
            channels: "#/components/schemas/ResolvedChannel",
            members: "#/components/schemas/ResolvedGuildMember",
            messages: "#/components/schemas/PartialMessage",
            roles: "#/components/schemas/PublicRole",
            users: "#/components/schemas/PartialUser",
        });
    });

    test("public message route responses do not point at the internal Message entity schema", () => {
        const openapi = readJson("assets/openapi.json");
        const pathRefs = collectRefs(openapi.paths);

        assert.deepEqual(
            pathRefs.filter((ref) => ref === "#/components/schemas/Message"),
            [],
        );
    });

    test("public message contracts expose a sanitized application object and application_id", () => {
        const openapi = readJson("assets/openapi.json");
        const schemas = readJson("assets/schemas.json");
        const openApiPublicMessage = resolveOpenApi(openapi, openapi.components.schemas.APIPublicMessage);
        const assetPublicMessage = resolveAssetSchema(schemas, schemas.APIPublicMessage);
        const unsafeApplicationFields = ["verify_key", "owner", "bot", "redirect_uris", "team"];

        assert.ok(openApiPublicMessage.properties?.application_id, "OpenAPI PublicMessage should expose application_id");
        const openApiApplication = resolveOpenApi(openapi, openApiPublicMessage.properties!.application!);
        assert.ok(openApiApplication.properties?.id, "OpenAPI PublicMessage should expose application ids");
        assert.ok(openApiApplication.properties?.name, "OpenAPI PublicMessage should expose application names");
        for (const field of unsafeApplicationFields) {
            assert.equal(openApiApplication.properties?.[field], undefined, `OpenAPI PublicMessage application should not expose ${field}`);
        }

        assert.ok(assetPublicMessage.properties?.application_id, "validation PublicMessage should expose application_id");
        const assetApplication = resolveAssetSchema(schemas, assetPublicMessage.properties!.application!);
        assert.ok(assetApplication.properties?.id, "validation PublicMessage should expose application ids");
        assert.ok(assetApplication.properties?.name, "validation PublicMessage should expose application names");
        for (const field of unsafeApplicationFields) {
            assert.equal(assetApplication.properties?.[field], undefined, `validation PublicMessage application should not expose ${field}`);
        }
    });

    test("APIMessageArray is an array of public messages", () => {
        const schemas = readJson("assets/schemas.json");
        const apiMessageArray = resolveAssetSchema(schemas, schemas.APIMessageArray);
        const item = resolveAssetSchema(schemas, apiMessageArray.items!);

        assert.equal(apiMessageArray.type, "array");
        assert.equal(apiMessageArray.items?.$ref, "#/definitions/PublicMessage");
        assert.ok(item.properties?.member, "APIMessageArray items should expose the public message schema");
    });

    test("message sticker fields use the public sticker response contract", () => {
        const schemas = readJson("assets/schemas.json");
        const snapshot = resolveAssetSchema(schemas, schemas.MessageSnapshot);
        const snapshotMessage = resolveAssetSchema(schemas, snapshot.properties!.message!);

        assertMessageStickerFields(schemas.PublicMessage, (schema) => resolveAssetSchema(schemas, schema), "#/definitions/StickerResponse");
        assertMessageStickerFields(schemas.PreloadMessageResponse, (schema) => resolveAssetSchema(schemas, schema), "#/definitions/StickerResponse");
        assertMessageStickerFields(schemas.GuildMessagesSearchMessage, (schema) => resolveAssetSchema(schemas, schema), "#/definitions/StickerResponse");
        assertStickerResponseArray(snapshotMessage.properties!.sticker_items!, (schema) => resolveAssetSchema(schemas, schema), "#/definitions/StickerResponse");

        const messageSchemaRefs = ["PublicMessage", "APIPublicMessage", "PreloadMessageResponse", "GuildMessagesSearchMessage", "MessageSnapshot"].flatMap((name) =>
            collectRefs(resolveAssetSchema(schemas, schemas[name])),
        );
        assert.deepEqual(
            messageSchemaRefs.filter((ref) => ref === "#/definitions/Sticker"),
            [],
        );
    });

    test("OpenAPI message sticker fields use the public sticker response contract", () => {
        const openapi = readJson("assets/openapi.json");
        const snapshot = resolveOpenApi(openapi, openapi.components.schemas.MessageSnapshot);
        const snapshotMessage = resolveOpenApi(openapi, snapshot.properties!.message!);

        assertMessageStickerFields(openapi.components.schemas.APIPublicMessage, (schema) => resolveOpenApi(openapi, schema), "#/components/schemas/StickerResponse");
        assertMessageStickerFields(openapi.components.schemas.PreloadMessageResponse, (schema) => resolveOpenApi(openapi, schema), "#/components/schemas/StickerResponse");
        assertMessageStickerFields(openapi.components.schemas.GuildMessagesSearchMessage, (schema) => resolveOpenApi(openapi, schema), "#/components/schemas/StickerResponse");
        assertStickerResponseArray(snapshotMessage.properties!.sticker_items!, (schema) => resolveOpenApi(openapi, schema), "#/components/schemas/StickerResponse");

        const messageSchemaRefs = ["PublicMessage", "APIPublicMessage", "PreloadMessageResponse", "GuildMessagesSearchMessage", "MessageSnapshot"].flatMap((name) =>
            collectRefs(resolveOpenApi(openapi, openapi.components.schemas[name])),
        );
        assert.deepEqual(
            messageSchemaRefs.filter((ref) => ref === "#/components/schemas/Sticker"),
            [],
        );
    });

    test("generated public message contracts expose interaction metadata", () => {
        const schemas = readJson("assets/schemas.json");
        const publicMessage = resolveAssetSchema(schemas, schemas.PublicMessage);
        const interactionMetadata = resolveAssetSchema(schemas, publicMessage.properties!.interaction_metadata!);

        assert.equal(publicMessage.properties?.interaction, undefined);
        assert.ok(publicMessage.properties?.interaction_metadata, "PublicMessage should document interaction_metadata");
        assert.equal(interactionMetadata.properties?.id?.type, "string");
        assert.equal(interactionMetadata.properties?.user_id?.type, "string");
        assert.equal(interactionMetadata.properties?.name?.type, "string");
        assert.equal(interactionMetadata.properties?.authorizing_integration_owners?.type, "object");
    });

    test("OpenAPI public message contract exposes interaction metadata", () => {
        const openapi = readJson("assets/openapi.json");
        const publicMessage = resolveOpenApi(openapi, openapi.components.schemas.APIPublicMessage);
        const interactionMetadata = resolveOpenApi(openapi, publicMessage.properties!.interaction_metadata!);

        assert.equal(publicMessage.properties?.interaction, undefined);
        assert.ok(publicMessage.properties?.interaction_metadata, "APIPublicMessage should document interaction_metadata");
        assert.equal(interactionMetadata.properties?.id?.type, "string");
        assert.equal(interactionMetadata.properties?.user_id?.type, "string");
        assert.equal(interactionMetadata.properties?.name?.type, "string");
        assert.equal(interactionMetadata.properties?.authorizing_integration_owners?.type, "object");
    });
});

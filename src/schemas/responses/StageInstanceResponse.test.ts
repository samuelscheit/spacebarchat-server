import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Ajv from "ajv";

const schemaPath = path.join(process.cwd(), "assets", "schemas.json");
const rawSchemas = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajvSchemas = JSON.parse(readFileSync(schemaPath, "utf8").replaceAll("#/definitions/", ""));
const rawOpenApi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8"));

test("stage instance response schema describes Discord stage instance fields", () => {
    const schema = rawSchemas.StageInstanceResponse;

    assert.equal(schema.type, "object");
    assert.equal(schema.properties.id.type, "string");
    assert.equal(schema.properties.guild_id.type, "string");
    assert.equal(schema.properties.channel_id.type, "string");
    assert.equal(schema.properties.topic.type, "string");
    assert.equal(schema.properties.privacy_level.$ref, "#/definitions/StageInstancePrivacyLevel");
    assert.equal(schema.properties.discoverable_disabled.type, "boolean");
    assert.deepEqual(schema.properties.guild_scheduled_event_id.type, ["null", "string"]);
    assert.deepEqual(rawSchemas.StageInstancePrivacyLevel.enum, [1, 2]);
    assert.ok(!schema.required.includes("guild_scheduled_event_id"));
    assert.equal(rawSchemas.StageInstancesResponse, undefined);
});

test("stage instance request schemas describe create and modify payloads", () => {
    const createSchema = rawSchemas.StageInstanceCreateSchema;
    const modifySchema = rawSchemas.StageInstanceModifySchema;

    assert.deepEqual(createSchema.required, ["channel_id", "topic"]);
    assert.equal(createSchema.properties.channel_id.type, "string");
    assert.equal(createSchema.properties.topic.type, "string");
    assert.deepEqual(createSchema.properties.privacy_level.enum, [1, 2]);
    assert.equal(createSchema.properties.send_start_notification.type, "boolean");
    assert.equal(createSchema.properties.guild_scheduled_event_id.type, "string");
    assert.deepEqual(modifySchema.properties.privacy_level.enum, [1, 2]);
});

test("stage instance routes advertise singular source response schemas", () => {
    const rootRoute = readFileSync(path.join(process.cwd(), "src", "api", "routes", "stage-instances", "index.ts"), "utf8");
    const channelRoute = readFileSync(path.join(process.cwd(), "src", "api", "routes", "stage-instances", "#channel_id", "index.ts"), "utf8");

    assert.match(rootRoute, /requestBody:\s*"StageInstanceCreateSchema"/);
    assert.match(rootRoute, /body:\s*"StageInstanceResponse"/);
    assert.doesNotMatch(rootRoute, /StageInstancesResponse/);
    assert.match(channelRoute, /permission:\s*"VIEW_CHANNEL"/);
    assert.match(channelRoute, /requestBody:\s*"StageInstanceModifySchema"/);
    assert.match(channelRoute, /body:\s*"StageInstanceResponse"/);
    assert.match(channelRoute, /204:\s*\{\}/);
    assert.doesNotMatch(channelRoute, /StageInstancesResponse/);
});

test("stage instance OpenAPI paths use Discord-compatible channel-scoped routes", () => {
    assert.equal(rawOpenApi.paths["/stage-instances/"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/StageInstanceCreateSchema");
    assert.equal(rawOpenApi.paths["/stage-instances/"].post.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/StageInstanceResponse");
    assert.equal(rawOpenApi.paths["/stage-instances/{channel_id}/"].get.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/StageInstanceResponse");
    assert.equal(rawOpenApi.paths["/stage-instances/{channel_id}/"].patch.requestBody.content["application/json"].schema.$ref, "#/components/schemas/StageInstanceModifySchema");
    assert.equal(rawOpenApi.paths["/stage-instances/{channel_id}/"].delete.responses["204"].description, "No description available");
});

test("OpenAPI 3.1 output preserves JSON Schema null unions instead of nullable", () => {
    const nullablePaths: string[] = [];
    const visit = (value: unknown, currentPath: string) => {
        if (!value || typeof value !== "object") return;
        if (Object.prototype.hasOwnProperty.call(value, "nullable")) nullablePaths.push(currentPath);
        for (const [key, child] of Object.entries(value)) visit(child, `${currentPath}/${key}`);
    };

    assert.match(rawOpenApi.openapi, /^3\.1\./);
    visit(rawOpenApi, "#");
    assert.deepEqual(nullablePaths, []);
    assert.deepEqual(rawOpenApi.components.schemas.StageInstanceResponse.properties.guild_scheduled_event_id.type, ["null", "string"]);
});

test("stage instance schemas validate documented request and response shapes", () => {
    const ajv = new Ajv({
        allErrors: true,
        schemas: ajvSchemas,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });

    const validateResponse = ajv.getSchema("StageInstanceResponse");
    const validateCreate = ajv.getSchema("StageInstanceCreateSchema");
    const validateModify = ajv.getSchema("StageInstanceModifySchema");
    assert.ok(validateResponse);
    assert.ok(validateCreate);
    assert.ok(validateModify);

    assert.equal(
        validateResponse({
            id: "840647391636226060",
            guild_id: "197038439483310086",
            channel_id: "733488538393510049",
            topic: "Server Q&A",
            privacy_level: 2,
            discoverable_disabled: false,
            guild_scheduled_event_id: null,
        }),
        true,
    );
    assert.equal(validateCreate({ channel_id: "733488538393510049", topic: "Server Q&A", privacy_level: 2 }), true);
    assert.equal(validateModify({ privacy_level: 1 }), true);
    assert.equal(validateModify({ privacy_level: 3 }), false);
    assert.equal(validateResponse({ id: "840647391636226060", privacy_level: 2 }), false);
});

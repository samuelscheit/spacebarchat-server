import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Ajv from "ajv";

const schemaPath = path.join(process.cwd(), "assets", "schemas.json");
const rawSchemas = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajvSchemas = JSON.parse(readFileSync(schemaPath, "utf8").replaceAll("#/definitions/", ""));
const rawOpenApi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8"));

test("stage instances response schema describes Discord stage instance fields", () => {
    const schema = rawSchemas.StageInstanceResponse;

    assert.equal(rawSchemas.StageInstancesResponse.type, "array");
    assert.equal(rawSchemas.StageInstancesResponse.items.$ref, "#/definitions/StageInstanceResponse");
    assert.equal(schema.properties.id.type, "string");
    assert.equal(schema.properties.guild_id.type, "string");
    assert.equal(schema.properties.channel_id.type, "string");
    assert.equal(schema.properties.topic.type, "string");
    assert.equal(schema.properties.privacy_level.$ref, "#/definitions/StageInstancePrivacyLevel");
    assert.equal(schema.properties.discoverable_disabled.type, "boolean");
    assert.deepEqual(schema.properties.guild_scheduled_event_id.type, ["null", "string"]);
    assert.deepEqual(rawSchemas.StageInstancePrivacyLevel.enum, [1, 2]);
    assert.ok(!schema.required.includes("guild_scheduled_event_id"));
});

test("stage instances route advertises its response schema", () => {
    const response = rawOpenApi.paths["/stage-instances/"].get.responses["200"];

    assert.equal(response.content["application/json"].schema.$ref, "#/components/schemas/StageInstancesResponse");
});

test("stage instances validate documented response shape", () => {
    const ajv = new Ajv({
        allErrors: true,
        schemas: ajvSchemas,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });

    const validate = ajv.getSchema("StageInstancesResponse");
    assert.ok(validate);

    assert.equal(validate([]), true);

    assert.equal(
        validate([
            {
                id: "840647391636226060",
                guild_id: "197038439483310086",
                channel_id: "733488538393510010",
                topic: "Server Q&A",
                privacy_level: 2,
                discoverable_disabled: false,
                guild_scheduled_event_id: null,
            },
        ]),
        true,
    );

    assert.equal(
        validate([
            {
                id: "840647391636226060",
                guild_id: "197038439483310086",
                channel_id: "733488538393510010",
                topic: "Server Q&A",
                privacy_level: 3,
                discoverable_disabled: false,
                guild_scheduled_event_id: null,
            },
        ]),
        false,
    );

    assert.equal(
        validate([
            {
                id: "840647391636226060",
                guild_id: "197038439483310086",
                channel_id: "733488538393510010",
                topic: "Server Q&A",
                privacy_level: 2,
            },
        ]),
        false,
    );
});

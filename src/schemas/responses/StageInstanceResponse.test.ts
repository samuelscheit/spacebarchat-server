import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Ajv from "ajv";
import * as TJS from "typescript-json-schema";

const schemaPath = path.join(process.cwd(), "assets", "schemas.json");
const rawSchemas = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajvSchemas = JSON.parse(readFileSync(schemaPath, "utf8").replaceAll("#/definitions/", ""));
const rawOpenApi = JSON.parse(readFileSync(path.join(process.cwd(), "assets", "openapi.json"), "utf8"));

const schemaGeneratorSettings: TJS.PartialArgs = {
    required: true,
    ignoreErrors: true,
    excludePrivate: true,
    defaultNumberType: "integer",
    noExtraProps: true,
    defaultProps: false,
    typeOfKeyword: false,
};

function sanitizeGeneratedSchema(schema: TJS.Definition | null): Record<string, unknown> {
    assert.ok(schema);
    const { additionalProperties, enum: schemaEnum, properties, required, type } = schema as Record<string, unknown>;
    return { additionalProperties, enum: schemaEnum, properties, required, type };
}

function getGeneratedSchemas(names: string[]): Record<string, Record<string, unknown>> {
    const program = TJS.programFromConfig(path.join(process.cwd(), "tsconfig.json"));
    return Object.fromEntries(names.map((name) => [name, sanitizeGeneratedSchema(TJS.generateSchema(program, name, schemaGeneratorSettings))]));
}

function schemaName(ref: string): string {
    return ref.split("/").at(-1) ?? "";
}

function getGeneratedStageRouteDescriptions(): Map<string, { permission?: string; requestBody?: string; responses?: Record<string, { body?: string }> } | null> {
    const coverageDir = mkdtempSync(path.join(tmpdir(), "stage-route-coverage-"));
    try {
        const output = execFileSync(
            process.execPath,
            [
                "-r",
                "dotenv/config",
                "-r",
                "module-alias/register",
                "-e",
                `
                    const Module = require("node:module");
                    const path = require("node:path");
                    const originalLoad = Module._load;
                    process.argv[1] = path.join(process.cwd(), "scripts", "openapi.js");
                    console.log = () => undefined;
                    console.error = () => undefined;
                    Module._load = function (request, parent, isMain) {
                        const loaded = originalLoad.call(this, request, parent, isMain);
                        if (request !== "lambert-server") return loaded;
                        return {
                            ...loaded,
                            traverseDirectory(options, callback) {
                                callback(path.join(options.dirname, "stage-instances", "index.js"));
                                callback(path.join(options.dirname, "stage-instances", "#channel_id", "index.js"));
                            },
                        };
                    };
                    const getRouteDescriptions = require("./scripts/util/getRouteDescriptions.js");
                    const stageRoutes = [...getRouteDescriptions()].filter(([key]) => key.includes("stage-instances"));
                    process.stdout.write(JSON.stringify(stageRoutes));
                `,
            ],
            {
                cwd: process.cwd(),
                encoding: "utf8",
                env: { ...process.env, NODE_V8_COVERAGE: coverageDir },
            },
        );

        return new Map(JSON.parse(output) as [string, { permission?: string; requestBody?: string; responses?: Record<string, { body?: string }> } | null][]);
    } finally {
        rmSync(coverageDir, { recursive: true, force: true });
    }
}

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

test("stage instance generated artifacts match current TypeScript route and schema sources", () => {
    const generatedSchemas = getGeneratedSchemas(["StageInstanceResponse", "StageInstanceCreateSchema", "StageInstanceModifySchema", "StageInstancePrivacyLevel"]);

    assert.deepEqual(generatedSchemas.StageInstanceResponse, sanitizeGeneratedSchema(rawSchemas.StageInstanceResponse));
    assert.deepEqual(generatedSchemas.StageInstanceCreateSchema, sanitizeGeneratedSchema(rawSchemas.StageInstanceCreateSchema));
    assert.deepEqual(generatedSchemas.StageInstanceModifySchema, sanitizeGeneratedSchema(rawSchemas.StageInstanceModifySchema));
    assert.deepEqual(generatedSchemas.StageInstancePrivacyLevel, sanitizeGeneratedSchema(rawSchemas.StageInstancePrivacyLevel));

    const generatedRoutes = getGeneratedStageRouteDescriptions();
    const rootRoute = generatedRoutes.get("/stage-instances/|post");
    const getRoute = generatedRoutes.get("/stage-instances/:channel_id/|get");
    const patchRoute = generatedRoutes.get("/stage-instances/:channel_id/|patch");
    const deleteRoute = generatedRoutes.get("/stage-instances/:channel_id/|delete");
    const openApiRootRoute = rawOpenApi.paths["/stage-instances/"].post;
    const openApiGetRoute = rawOpenApi.paths["/stage-instances/{channel_id}/"].get;
    const openApiPatchRoute = rawOpenApi.paths["/stage-instances/{channel_id}/"].patch;

    assert.equal(rootRoute?.requestBody, schemaName(openApiRootRoute.requestBody.content["application/json"].schema.$ref));
    assert.equal(rootRoute?.responses?.["200"]?.body, schemaName(openApiRootRoute.responses["200"].content["application/json"].schema.$ref));
    assert.equal(getRoute?.permission, "VIEW_CHANNEL");
    assert.equal(getRoute?.responses?.["200"]?.body, schemaName(openApiGetRoute.responses["200"].content["application/json"].schema.$ref));
    assert.equal(patchRoute?.requestBody, schemaName(openApiPatchRoute.requestBody.content["application/json"].schema.$ref));
    assert.equal(patchRoute?.responses?.["200"]?.body, schemaName(openApiPatchRoute.responses["200"].content["application/json"].schema.$ref));
    assert.deepEqual(deleteRoute?.responses?.["204"], {});
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

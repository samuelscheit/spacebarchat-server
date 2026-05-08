import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { FrecencyUserSettings, PreloadedUserSettings } from "discord-protos";

interface JsonShape {
    $ref?: string;
    additionalProperties?: boolean | JsonShape;
    components?: { schemas?: Record<string, JsonShape> };
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(fs.readFileSync("assets/schemas.json", "utf8")) as Record<string, JsonShape>;
}

function readOpenApiSchemas(): Record<string, JsonShape> {
    const openapi = JSON.parse(fs.readFileSync("assets/openapi.json", "utf8")) as JsonShape;

    return openapi.components?.schemas ?? {};
}

function createSettingsProtoAjv() {
    const schemas = JSON.parse(fs.readFileSync("assets/schemas.json", "utf8").replaceAll("#/definitions/", "")) as Record<string, JsonShape>;
    const ajv = new Ajv({
        allErrors: true,
        schemas: {
            SettingsProtoUpdateJsonResponse: schemas.SettingsProtoUpdateJsonResponse,
            JsonValue: schemas.JsonValue,
            JsonObject: schemas.JsonObject,
        },
        coerceTypes: true,
        messages: true,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });
    addFormats(ajv);

    return ajv;
}

function preloadedUserSettingsJson() {
    return PreloadedUserSettings.toJson(
        PreloadedUserSettings.create({
            versions: { clientVersion: 0, serverVersion: 0, dataVersion: 1 },
            voiceAndVideo: { soundboardSettings: { volume: 0.5 } },
            guildFolders: {
                folders: [{ guildIds: [123n, 456n], id: { value: 1n } }],
                guildPositions: [],
            },
        }),
    );
}

function frecencyUserSettingsJson() {
    return FrecencyUserSettings.toJson(
        FrecencyUserSettings.create({
            versions: { clientVersion: 0, serverVersion: 0, dataVersion: 1 },
            favoriteGifs: {
                gifs: {
                    example: {
                        format: 0,
                        src: "https://example.invalid/a.gif",
                        width: 10,
                        height: 10,
                        order: 1,
                    },
                },
                hideTooltip: false,
            },
        }),
    );
}

test("SettingsProtoUpdateJsonResponse keeps protobuf settings as generic JSON", () => {
    const schemas = readSchemas();
    const response = schemas.SettingsProtoUpdateJsonResponse;

    assert.deepEqual(response.properties?.settings, { $ref: "#/definitions/JsonValue" });
    assert.equal(response.properties?.out_of_date?.type, "boolean");
    assert.deepEqual(response.required, ["settings"]);
    assert.equal(response.additionalProperties, false);

    assert.equal(schemas.SettingsProtoUpdatePreloadedUserSettingsJsonResponse, undefined);
    assert.equal(schemas.SettingsProtoUpdateFrecencyUserSettingsJsonResponse, undefined);
});

test("SettingsProtoUpdateJsonResponse keeps OpenAPI protobuf settings as generic JSON", () => {
    const schemas = readOpenApiSchemas();
    const response = schemas.SettingsProtoUpdateJsonResponse;

    assert.deepEqual(response.properties?.settings, { $ref: "#/components/schemas/JsonValue" });
    assert.equal(response.properties?.out_of_date?.type, "boolean");
    assert.deepEqual(response.required, ["settings"]);

    assert.equal(schemas.SettingsProtoUpdatePreloadedUserSettingsJsonResponse, undefined);
    assert.equal(schemas.SettingsProtoUpdateFrecencyUserSettingsJsonResponse, undefined);
});

test("SettingsProtoUpdateJsonResponse validates protobuf JSON response shapes without protobuf semantic overreach", () => {
    const ajv = createSettingsProtoAjv();
    const preloadedSettings = preloadedUserSettingsJson();
    const frecencySettings = frecencyUserSettingsJson();

    assert.equal(
        ajv.validate("SettingsProtoUpdateJsonResponse", {
            settings: preloadedSettings,
            out_of_date: false,
        }),
        true,
        JSON.stringify(ajv.errors),
    );

    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { settings: frecencySettings, out_of_date: true }), true, JSON.stringify(ajv.errors));
    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { settings: {}, unexpected: true }), false);
    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { out_of_date: false }), false);
});

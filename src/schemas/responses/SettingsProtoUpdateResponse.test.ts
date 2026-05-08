import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

interface JsonShape {
    $ref?: string;
    additionalProperties?: boolean | JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readSchemas(): Record<string, JsonShape> {
    return JSON.parse(fs.readFileSync("assets/schemas.json", "utf8")) as Record<string, JsonShape>;
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

test("SettingsProtoUpdateJsonResponse validates protobuf JSON response shapes without protobuf semantic overreach", () => {
    const ajv = createSettingsProtoAjv();

    assert.equal(
        ajv.validate("SettingsProtoUpdateJsonResponse", {
            settings: {
                versions: { dataVersion: 1 },
                voiceAndVideo: { soundboardSettings: { volume: 0.5 } },
                guildFolders: { folders: [{ id: 1, guildIds: ["123", "456"] }] },
            },
            out_of_date: false,
        }),
        true,
        JSON.stringify(ajv.errors),
    );

    assert.equal(
        ajv.validate("SettingsProtoUpdateJsonResponse", {
            settings: {
                favoriteGifs: { gifs: { example: { src: "https://example.invalid/a.gif", width: 10, height: 10, order: 1 } } },
            },
            out_of_date: true,
        }),
        true,
        JSON.stringify(ajv.errors),
    );

    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { settings: "base64 belongs to SettingsProtoUpdateResponse" }), true);
    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { settings: {}, unexpected: true }), false);
    assert.equal(ajv.validate("SettingsProtoUpdateJsonResponse", { out_of_date: false }), false);
});

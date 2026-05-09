import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    type?: string | string[];
};

const Schemas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "assets", "schemas.json"), { encoding: "utf8" })) as Record<string, JsonSchema>;

function getIdentifyValidator() {
    const validate = ajv.getSchema("IdentifySchema");
    assert.ok(validate);
    return validate;
}

function schemaTypes(schema: JsonSchema | undefined): string[] {
    assert.ok(schema);

    return schemaTypesFromResolved(resolveSchema(schema));
}

function resolveSchema(schema: JsonSchema | undefined): JsonSchema {
    assert.ok(schema);

    if (schema.$ref) {
        const match = /^#\/definitions\/(.+)$/.exec(schema.$ref);
        assert.ok(match, `unexpected schema ref ${schema.$ref}`);
        return resolveSchema(Schemas[match[1]]);
    }

    return schema;
}

function schemaTypesFromResolved(schema: JsonSchema): string[] {
    return (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((type): type is string => typeof type === "string").sort();
}

function hasMutualExclusion(schema: JsonSchema | undefined, left: string, right: string) {
    const constrainedSchema = resolveSchema(schema) as JsonSchema & { allOf?: Array<{ not?: { required?: string[] } }> };

    return constrainedSchema.allOf?.some((entry) => {
        const required = entry.not?.required;
        return required?.length === 2 && required.includes(left) && required.includes(right);
    });
}

test("IdentifySchema emits valid JSON Schema for gateway bitfields", () => {
    const schema = Schemas.IdentifySchema;
    assert.ok(schema);
    assert.deepEqual(schemaTypes(schema.properties?.intents), ["integer", "string"]);
    assert.equal(schema.properties?.shard?.type, "array");
    assert.deepEqual(schemaTypes(schema.properties?.shard?.items), ["integer", "string"]);
});

test("IdentifySchema emits alias mutual-exclusion rules", () => {
    const schema = Schemas.IdentifySchema;
    assert.ok(schema);

    assert.equal(hasMutualExclusion(schema, "large_threshold", "largeThreshold"), true);
    assert.equal(hasMutualExclusion(schema, "client_state", "clientState"), true);
    assert.equal(hasMutualExclusion(schema.properties?.client_state, "private_channels_version", "privateChannelsVersion"), true);
    assert.equal(hasMutualExclusion(schema.properties?.clientState, "private_channels_version", "privateChannelsVersion"), true);
});

test("IdentifySchema validator accepts JSON-safe integer and string bitfields", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            intents: 513,
            shard: [0, 2],
        }),
        true,
        JSON.stringify(validate.errors),
    );

    assert.equal(
        validate({
            token: "token",
            properties: {},
            intents: "1099511627776",
            shard: ["1", "16"],
        }),
        true,
        JSON.stringify(validate.errors),
    );
});

test("IdentifySchema validator accepts snake_case identify compatibility fields", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            large_threshold: 50,
            client_state: {
                guild_hashes: {},
                highest_last_message_id: 1,
                read_state_version: 2,
                user_guild_settings_version: 3,
                user_settings_version: 4,
                useruser_guild_settings_version: 5,
                private_channels_version: 6,
                guild_versions: {},
                api_code_version: 7,
                initial_guild_id: "8",
            },
        }),
        true,
        JSON.stringify(validate.errors),
    );
});

test("IdentifySchema validator accepts camelCase identify compatibility fields", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            largeThreshold: 50,
            clientState: {
                guildHashes: {},
                highestLastMessageId: 1,
                readStateVersion: 2,
                userGuildSettingsVersion: 3,
                userSettingsVersion: 4,
                useruserGuildSettingsVersion: 5,
                privateChannelsVersion: 6,
                guildVersions: {},
                apiCodeVersion: 7,
                initialGuildId: "8",
            },
        }),
        true,
        JSON.stringify(validate.errors),
    );
});

test("IdentifySchema validator accepts nested client state aliases on either outer spelling", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            client_state: {
                guildHashes: {},
                privateChannelsVersion: 6,
            },
        }),
        true,
        JSON.stringify(validate.errors),
    );

    assert.equal(
        validate({
            token: "token",
            properties: {},
            clientState: {
                guild_hashes: {},
                private_channels_version: 6,
            },
        }),
        true,
        JSON.stringify(validate.errors),
    );
});

test("IdentifySchema validator rejects both spellings of top-level aliases", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            large_threshold: 50,
            largeThreshold: 50,
        }),
        false,
    );

    assert.equal(
        validate({
            token: "token",
            properties: {},
            client_state: {},
            clientState: {},
        }),
        false,
    );
});

test("IdentifySchema validator rejects both spellings of nested client state aliases", () => {
    const validate = getIdentifyValidator();

    assert.equal(
        validate({
            token: "token",
            properties: {},
            clientState: {
                private_channels_version: 6,
                privateChannelsVersion: 6,
            },
        }),
        false,
    );
});

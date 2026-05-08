import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
    [key: string]: unknown;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

function collectDefinitionRefs(schema: unknown, refs = new Set<string>()): Set<string> {
    if (!schema || typeof schema !== "object") return refs;

    const ref = (schema as JsonShape).$ref;
    const match = typeof ref === "string" ? /^#\/definitions\/(.+)$/.exec(ref) : undefined;
    if (match) refs.add(match[1]);

    for (const child of Object.values(schema as Record<string, unknown>)) collectDefinitionRefs(child, refs);

    return refs;
}

function collectReferencedDefinitions(root: JsonShape, schemas: Record<string, JsonShape>): Record<string, JsonShape> {
    const definitions: Record<string, JsonShape> = {};
    const pending = [...collectDefinitionRefs(root)];

    for (let index = 0; index < pending.length; index++) {
        const name = pending[index];
        if (definitions[name]) continue;

        const definition = schemas[name];
        assert.ok(definition, `missing schema definition ${name}`);
        definitions[name] = definition;

        for (const ref of collectDefinitionRefs(definition)) {
            if (!definitions[ref] && !pending.includes(ref)) pending.push(ref);
        }
    }

    return definitions;
}

function compileAssetSchema(name: string, schemas: Record<string, JsonShape>) {
    const schema = schemas[name];
    assert.ok(schema, `missing schema ${name}`);

    const validator = new Ajv({
        allErrors: true,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });
    addFormats(validator);

    return validator.compile({
        ...schema,
        definitions: collectReferencedDefinitions(schema, schemas),
    });
}

test("UserProfileResponse schema matches route-owned profile fields", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.UserProfileResponse;
    const properties = response.properties;

    assert.equal(properties?.connected_accounts?.type, "array");
    assert.equal(properties?.connected_accounts?.items?.$ref, "#/definitions/PartialConnectedAccountResponse");
    assert.notEqual(properties?.connected_accounts?.$ref, "#/definitions/PublicConnectedAccount");
    assert.equal(response.required?.includes("mutual_guilds"), false);
    assert.deepEqual(properties?.mutual_guilds?.items?.required?.sort(), ["id", "nick"]);
    assert.deepEqual(properties?.mutual_guilds?.items?.properties?.nick?.type, ["null", "string"]);
    assert.equal(properties?.mutual_friends?.type, "array");
    assert.equal(properties?.mutual_friends_count?.type, "integer");

    const connectedAccountProperties = schemas.PartialConnectedAccountResponse.properties;
    assert.deepEqual(Object.keys(connectedAccountProperties ?? {}).sort(), ["id", "metadata", "name", "type", "verified"]);
    assert.deepEqual(schemas.PartialConnectedAccountResponse.required?.sort(), ["id", "name", "type", "verified"]);

    for (const property of ["badges", "guild_badges"]) {
        assert.equal(properties?.[property]?.type, "array");
        assert.equal(properties?.[property]?.items?.$ref, "#/definitions/ProfileBadge");
    }
    assert.deepEqual(Object.keys(schemas.ProfileBadge.properties ?? {}).sort(), ["description", "icon", "id", "link"]);
    assert.equal(schemas.ProfileBadge.properties?.link?.type, "string");
    assert.deepEqual(schemas.UserProfile.properties?.bio?.type, ["null", "string"]);
});

test("UserProfileResponse validates visible connected accounts and optional query fields", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const validate = compileAssetSchema("UserProfileResponse", schemas);
    const response = {
        connected_accounts: [
            {
                id: "connection-1",
                type: "github",
                name: "alice",
                verified: true,
                metadata: { verified_at: "2026-05-06T00:00:00.000Z" },
            },
        ],
        premium_since: null,
        user: {
            id: "100",
            username: "alice",
            discriminator: "0001",
            public_flags: 0,
            bot: false,
            bio: "",
            premium_since: null,
            premium_type: 0,
        },
        premium_type: 0,
        profile_themes_experiment_bucket: 4,
        user_profile: {
            bio: null,
            accent_color: null,
            banner: null,
            pronouns: null,
            theme_colors: null,
        },
        badges: [
            {
                id: "early_supporter",
                description: "Early Supporter",
                icon: "supporter",
            },
        ],
        guild_badges: [],
        mutual_guilds: [
            { id: "guild-1", nick: null },
            { id: "guild-2", nick: "Alice" },
        ],
    };

    assert.equal(validate(response), true);
    assert.equal(validate({ ...response, connected_accounts: response.connected_accounts[0] }), false);
    assert.equal(validate({ ...response, connected_accounts: [{ ...response.connected_accounts[0], metadata: null }] }), false);
    assert.equal(validate({ ...response, mutual_guilds: [{ id: "guild-1" }] }), false);
    assert.equal(validate({ ...response, mutual_guilds: [{ id: "guild-1", nick: undefined }] }), false);
    assert.equal(validate({ ...response, guild_member: { user: response.user } }), false);
});

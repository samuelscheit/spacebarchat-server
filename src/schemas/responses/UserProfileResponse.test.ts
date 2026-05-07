import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("UserProfileResponse schema matches route-owned profile fields", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.UserProfileResponse;
    const properties = response.properties;

    assert.equal(properties?.connected_accounts?.type, "array");
    assert.equal(properties?.connected_accounts?.items?.$ref, "#/definitions/PartialConnectedAccountResponse");
    assert.notEqual(properties?.connected_accounts?.$ref, "#/definitions/PublicConnectedAccount");
    assert.equal(response.required?.includes("mutual_guilds"), false);
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
    };

    assert.equal(ajv.validate("UserProfileResponse", response), true);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, connected_accounts: response.connected_accounts[0] }), false);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, connected_accounts: [{ ...response.connected_accounts[0], metadata: null }] }), false);
    assert.equal(ajv.validate("UserProfileResponse", { ...response, guild_member: { user: response.user } }), false);
});

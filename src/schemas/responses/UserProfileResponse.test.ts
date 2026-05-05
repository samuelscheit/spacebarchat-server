import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("UserProfileResponse schema", () => {
    test("documents profile and guild badge arrays", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));
        const properties = schemas.UserProfileResponse.properties;

        assert.equal(properties.connected_accounts.type, "array");

        for (const property of ["badges", "guild_badges"]) {
            assert.equal(properties[property].type, "array");
            assert.equal(properties[property].items.$ref, "#/definitions/ProfileBadge");
        }
        assert.deepEqual(Object.keys(schemas.ProfileBadge.properties).sort(), ["description", "icon", "id", "link"]);
    });
});

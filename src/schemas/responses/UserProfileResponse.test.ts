import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("UserProfileResponse schema", () => {
    test("documents profile connected account and badge arrays", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));
        const properties = schemas.UserProfileResponse.properties;

        assert.equal(properties.connected_accounts.type, "array");
        assert.equal(properties.connected_accounts.items.$ref, "#/definitions/PartialConnectedAccountResponse");

        const connectedAccountProperties = schemas.PartialConnectedAccountResponse.properties;
        assert.deepEqual(Object.keys(connectedAccountProperties).sort(), ["id", "metadata", "name", "type", "verified"]);
        assert.deepEqual(schemas.PartialConnectedAccountResponse.required.sort(), ["id", "name", "type", "verified"]);

        for (const property of ["badges", "guild_badges"]) {
            assert.equal(properties[property].type, "array");
            assert.equal(properties[property].items.$ref, "#/definitions/ProfileBadge");
        }
        assert.deepEqual(Object.keys(schemas.ProfileBadge.properties).sort(), ["description", "icon", "id", "link"]);
    });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

describe("OAuthAuthorizeInfoResponse schema", () => {
    test("describes the GET /oauth2/authorize response payload", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));
        const properties = schemas.OAuthAuthorizeInfoResponse.properties;

        assert.equal(properties.guilds.items.$ref, "#/definitions/OAuthAuthorizeInfoGuild");
        assert.equal(properties.user.$ref, "#/definitions/OAuthAuthorizeInfoUser");
        assert.equal(properties.application.$ref, "#/definitions/OAuthAuthorizeInfoApplication");
        assert.equal(properties.bot.$ref, "#/definitions/OAuthAuthorizeInfoBot");
        assert.deepEqual(schemas.OAuthAuthorizeInfoResponse.required, ["application", "authorized", "bot", "guilds", "user"]);
    });

    test("documents GET /oauth2/authorize with the OAuth authorize info response", () => {
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8"));
        const schema = openapi.paths["/oauth2/authorize/"].get.responses["200"].content["application/json"].schema;

        assert.deepEqual(schema, { $ref: "#/components/schemas/OAuthAuthorizeInfoResponse" });
    });
});

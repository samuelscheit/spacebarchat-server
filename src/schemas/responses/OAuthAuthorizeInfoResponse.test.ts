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
        assert.deepEqual(schemas.OAuthAuthorizeInfoApplication.properties.type, {
            anyOf: [
                {
                    enum: [1, 2, 3, 4],
                    type: "number",
                },
                {
                    type: "null",
                },
            ],
        });
        assert.ok(schemas.OAuthAuthorizeInfoUser.properties.avatar_decoration_data);
        assert.ok(schemas.OAuthAuthorizeInfoBot.properties.avatar_decoration_data);
        assert.equal("avatar_decoration" in schemas.OAuthAuthorizeInfoUser.properties, false);
        assert.equal("avatar_decoration" in schemas.OAuthAuthorizeInfoBot.properties, false);
    });

    test("documents GET /oauth2/authorize with the OAuth authorize info response", () => {
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8"));
        const schema = openapi.paths["/oauth2/authorize/"].get.responses["200"].content["application/json"].schema;

        assert.deepEqual(schema, { $ref: "#/components/schemas/OAuthAuthorizeInfoResponse" });
        assert.deepEqual(openapi.components.schemas.OAuthAuthorizeInfoApplication.properties.type, {
            anyOf: [
                {
                    enum: [1, 2, 3, 4],
                    type: "number",
                },
                {
                    type: "null",
                },
            ],
        });
    });
});

describe("OAuthAuthorizationResponse schema", () => {
    test("describes the OAuth2 authorization response payload", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));
        const schema = schemas.OAuthAuthorizationResponse;

        assert.equal(schema.properties.id.type, "string");
        assert.deepEqual(schema.properties.scopes, {
            items: {
                type: "string",
            },
            type: "array",
        });
        assert.deepEqual(schema.properties.application, {
            $ref: "#/definitions/APIApplication",
        });
        assert.deepEqual(schema.required, ["application", "id", "scopes"]);
    });
});

describe("OAuthCurrentAuthorizationResponse schema", () => {
    test("describes GET /oauth2/@me current authorization payload", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8"));
        const schema = schemas.OAuthCurrentAuthorizationResponse;

        assert.deepEqual(schema.properties.application, {
            $ref: "#/definitions/APIApplication",
        });
        assert.deepEqual(schema.properties.scopes, {
            items: {
                type: "string",
            },
            type: "array",
        });
        assert.equal(schema.properties.expires.type, "string");
        assert.deepEqual(schema.properties.user, {
            $ref: "#/definitions/PublicUser",
        });
        assert.deepEqual(schema.required, ["application", "expires", "scopes"]);
    });

    test("documents GET /oauth2/@me with the current authorization response", () => {
        const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8"));
        const operation = openapi.paths["/oauth2/@me/"].get;

        assert.deepEqual(operation.responses["200"].content["application/json"].schema, {
            $ref: "#/components/schemas/OAuthCurrentAuthorizationResponse",
        });
        assert.deepEqual(operation.responses["400"].content["application/json"].schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
        assert.deepEqual(operation.responses["401"].content["application/json"].schema, {
            $ref: "#/components/schemas/APIErrorResponse",
        });
    });
});

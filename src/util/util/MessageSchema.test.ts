import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Generated public Message schema", () => {
    test("serializes mention_roles as snowflake ids", () => {
        const schemaPath = path.join(__dirname, "../../../assets/schemas.json");
        const schemas = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
        const messageMentionRoles = schemas.Message?.properties?.mention_roles;
        const publicMessageMentionRoles = schemas.PublicMessage?.properties?.mention_roles;

        for (const mentionRoles of [messageMentionRoles, publicMessageMentionRoles]) {
            assert.equal(mentionRoles?.type, "array");
            assert.equal(mentionRoles.items?.type, "string");
            assert.equal(mentionRoles.items?.$ref, undefined);
        }
        assert.equal(schemas.APIMessageArray?.items?.$ref, "#/definitions/PublicMessage");
    });

    test("documents message routes with the public message contract", () => {
        const openApiPath = path.join(__dirname, "../../../assets/openapi.json");
        const openApi = JSON.parse(fs.readFileSync(openApiPath, "utf8"));
        const messageMentionRoles = openApi.components?.schemas?.Message?.properties?.mention_roles;
        const mentionRoles = openApi.components?.schemas?.PublicMessage?.properties?.mention_roles;
        const singleMessageGet = openApi.paths?.["/channels/{channel_id}/messages/{message_id}/"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema;

        for (const mentionRoleSchema of [messageMentionRoles, mentionRoles]) {
            assert.equal(mentionRoleSchema?.type, "array");
            assert.equal(mentionRoleSchema.items?.type, "string");
        }
        assert.deepEqual(singleMessageGet, {
            $ref: "#/components/schemas/APIPublicMessage",
        });
    });
});

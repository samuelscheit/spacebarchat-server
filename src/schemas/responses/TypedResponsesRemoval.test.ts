import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
};

type SchemaMap = Record<string, JsonSchema>;

function readJsonAsset<T>(filename: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", filename), "utf8")) as T;
}

function resolveSchema(schemas: SchemaMap, schema: JsonSchema): JsonSchema {
    let current = schema;
    while (current.$ref) {
        const name = current.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
        current = schemas[name];
    }
    return current;
}

describe("TypedResponses migration", () => {
    test("does not re-export the removed catch-all response file", () => {
        assert.equal(existsSync(join(process.cwd(), "src/schemas/responses/TypedResponses.ts")), false);

        const responseIndex = readFileSync(join(process.cwd(), "src/schemas/responses/index.ts"), "utf8");
        assert.doesNotMatch(responseIndex, /TypedResponses/);
    });

    test("keeps legacy response schema names available from domain response modules", () => {
        const schemas = readJsonAsset<SchemaMap>("schemas.json");

        const legacyTypedResponseNames = [
            "APIGuild",
            "APIPublicUser",
            "APIPrivateUser",
            "APIGuildArray",
            "APIDMChannelArray",
            "APIBackupCodeArray",
            "UserUpdateResponse",
            "ApplicationDetectableResponse",
            "ApplicationEntitlementsResponse",
            "ApplicationSkusResponse",
            "APIApplicationArray",
            "APIInviteArray",
            "APIPublicMessage",
            "MessageListResponse",
            "APIWebhookArray",
            "APIDiscoveryCategoryArray",
            "APIGeneralConfiguration",
            "APIChannelArray",
            "APIMemberArray",
            "APIPublicMember",
            "APIGuildWithJoinedAt",
            "APIRoleArray",
            "APITemplateArray",
            "APIGuildVoiceRegion",
            "APILimitsConfiguration",
            "APIMessageArray",
            "APIConnectionsConfiguration",
        ];

        for (const name of legacyTypedResponseNames) {
            assert.ok(schemas[name], `${name} should remain generated after deleting TypedResponses.ts`);
        }

        const apiMessageArray = resolveSchema(schemas, schemas.APIMessageArray);
        assert.equal(apiMessageArray.type, "array");
        assert.equal(apiMessageArray.items?.$ref, "#/definitions/PublicMessage");

        const webhookArray = resolveSchema(schemas, schemas.APIWebhookArray);
        assert.equal(webhookArray.type, "array");
        assert.equal(webhookArray.items?.$ref, "#/definitions/APIWebhook");
    });
});

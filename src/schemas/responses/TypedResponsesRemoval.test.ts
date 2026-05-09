import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
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

    test("legacy response arrays reference schema-owned DTOs instead of persistence entities", () => {
        const schemas = readJsonAsset<SchemaMap>("schemas.json");
        const legacyEntityArrayRefs = {
            APIBackupCodeArray: "#/definitions/BackupCode",
            APIApplicationArray: "#/definitions/Application",
            APIInviteArray: "#/definitions/Invite",
            APIDiscoveryCategoryArray: "#/definitions/Categories",
            APIChannelArray: "#/definitions/Channel",
            APIMemberArray: "#/definitions/Member",
            APIRoleArray: "#/definitions/Role",
            APITemplateArray: "#/definitions/Template",
        } as const;

        for (const [schemaName, legacyEntityRef] of Object.entries(legacyEntityArrayRefs)) {
            const itemRef = resolveSchema(schemas, schemas[schemaName]).items?.$ref;

            assert.ok(itemRef, `${schemaName} should be an array schema with a referenced item type`);
            assert.notEqual(itemRef, legacyEntityRef, `${schemaName} should not expose ${legacyEntityRef}`);
            assert.match(itemRef, /^#\/definitions\/(API|Public)/, `${schemaName} should reference a public response DTO, got ${itemRef}`);
        }
    });

    test("schema-owned DTOs retain representative public fields", () => {
        const schemas = readJsonAsset<SchemaMap>("schemas.json");
        const guildProperties = schemas.APIGuild.properties ?? {};

        for (const internalProperty of ["insert", "get_annotations", "clean_data", "toGuildUpdateEventData", "afk_channel", "template", "owner"]) {
            assert.equal(guildProperties[internalProperty], undefined, `APIGuild should not expose ${internalProperty}`);
        }

        assert.deepEqual(schemas.APIBackupCode.required, ["code", "consumed", "id"]);
        assert.equal(schemas.APIApplication.properties?.name?.type, "string");
        assert.equal(schemas.APIInvite.properties?.code?.type, "string");
        assert.equal(schemas.APIDiscoveryCategory.properties?.localizations?.$ref, "#/definitions/CategoryLocalizations");
        assert.equal(schemas.APIChannel.properties?.permission_overwrites?.items?.$ref, "#/definitions/ChannelPermissionOverwrite");
        assert.equal(schemas.APIRole.properties?.colors?.$ref, "#/definitions/RoleColors");
        assert.equal(schemas.APITemplate.properties?.serialized_source_guild?.$ref, "#/definitions/APITemplateGuild");
    });

    test("domain modules that own legacy schema names do not import persistence entities", () => {
        const files = [
            "src/schemas/responses/BackupCodesChallengeResponse.ts",
            "src/schemas/responses/DiscoverableGuildsResponse.ts",
            "src/schemas/responses/DmMessagesResponseSchema.ts",
            "src/schemas/responses/GuildBansResponse.ts",
            "src/schemas/responses/GuildCreateResponse.ts",
            "src/schemas/responses/InstanceConfigResponse.ts",
            "src/schemas/responses/InviteResponse.ts",
            "src/schemas/responses/OAuthAuthorizeResponse.ts",
        ];

        for (const file of files) {
            const source = readFileSync(join(process.cwd(), file), "utf8");
            assert.doesNotMatch(
                source,
                /import(?:\s+type)?\s+\{[^}]*\b(?:Application|BackupCode|Categories|Channel|Guild|Invite|Member|Role|Template)\b[^}]*}\s+from\s+"@spacebar\/util"/,
                `${file} must not import persistence entities for generated response schemas`,
            );
        }
    });
});

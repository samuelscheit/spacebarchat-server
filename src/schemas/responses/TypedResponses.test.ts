import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

const schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;

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

describe("TypedResponses public schemas", () => {
    test("array responses reference schema-owned DTOs instead of persistence entities", () => {
        for (const [schemaName, legacyEntityRef] of Object.entries(legacyEntityArrayRefs)) {
            const itemRef = schemas[schemaName]?.items?.$ref;

            assert.ok(itemRef, `${schemaName} should be an array schema with a referenced item type`);
            assert.notEqual(itemRef, legacyEntityRef, `${schemaName} should not expose ${legacyEntityRef}`);
            assert.match(itemRef, /^#\/definitions\/(API|Public)/, `${schemaName} should reference a public response DTO, got ${itemRef}`);
        }
    });

    test("APIGuild does not expose TypeORM base/entity artifacts", () => {
        const properties = schemas.APIGuild.properties ?? {};

        for (const internalProperty of ["insert", "get_annotations", "clean_data", "toGuildUpdateEventData", "afk_channel", "template", "owner"]) {
            assert.equal(properties[internalProperty], undefined, `APIGuild should not expose ${internalProperty}`);
        }
    });

    test("typed response DTOs retain representative public fields", () => {
        assert.deepEqual(schemas.APIBackupCode.required, ["code", "consumed", "id"]);
        assert.equal(schemas.APIApplication.properties?.name?.type, "string");
        assert.equal(schemas.APIInvite.properties?.code?.type, "string");
        assert.equal(schemas.APIDiscoveryCategory.properties?.localizations?.$ref, "#/definitions/CategoryLocalizations");
        assert.equal(schemas.APIChannel.properties?.permission_overwrites?.items?.$ref, "#/definitions/ChannelPermissionOverwrite");
        assert.equal(schemas.APIRole.properties?.colors?.$ref, "#/definitions/RoleColors");
        assert.equal(schemas.APITemplate.properties?.serialized_source_guild?.$ref, "#/definitions/APITemplateGuild");
    });
});

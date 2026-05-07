import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const openapi = JSON.parse(readFileSync("assets/openapi.json", "utf8"));

describe("guild discovery metadata OpenAPI", () => {
    it("documents the GET and PATCH discovery metadata endpoints", () => {
        const path = openapi.paths["/guilds/{guild_id}/discovery-metadata/"];

        assert.equal(path.get.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/GuildDiscoveryMetadataResponse");
        assert.equal(path.patch.requestBody.content["application/json"].schema.$ref, "#/components/schemas/GuildDiscoveryMetadataUpdateSchema");
        assert.equal(path.patch.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/GuildDiscoveryMetadataResponse");
    });

    it("documents client-required discovery metadata fields", () => {
        const schema = openapi.components.schemas.GuildDiscoveryMetadataResponse;

        assert.deepEqual(schema.required, [
            "about",
            "category_ids",
            "emoji_discoverability_enabled",
            "guild_id",
            "is_published",
            "keywords",
            "partner_actioned_timestamp",
            "partner_application_timestamp",
            "primary_category_id",
            "reasons_to_join",
            "social_links",
        ]);
    });

    it("documents only persisted discovery metadata PATCH fields", () => {
        const schema = openapi.components.schemas.GuildDiscoveryMetadataUpdateSchema;

        assert.deepEqual(Object.keys(schema.properties).sort(), ["about", "is_published", "primary_category_id"]);
        assert.deepEqual(schema.properties.primary_category_id.type, ["null", "integer"]);
        assert.deepEqual(schema.properties.about.type, ["null", "string"]);
        assert.equal(Object.hasOwn(schema.properties.primary_category_id, "nullable"), false);
        assert.equal(Object.hasOwn(schema.properties.about, "nullable"), false);
    });
});

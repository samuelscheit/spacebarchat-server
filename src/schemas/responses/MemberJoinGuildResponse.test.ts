import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "node:test";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

function readSchemas() {
    return JSON.parse(fs.readFileSync("assets/schemas.json", "utf8")) as Record<string, JsonSchema>;
}

function assertMemberJoinGuildResponseUsesApiDtos(schemas: Record<string, JsonSchema>) {
    const response = schemas.MemberJoinGuildResponse;
    assert.ok(response, "Expected MemberJoinGuildResponse to be generated");

    assert.equal(response.properties?.emojis?.items?.$ref, "#/definitions/EmojiResponse");
    assert.equal(response.properties?.roles?.items?.$ref, "#/definitions/RoleResponse");
    assert.equal(response.properties?.stickers?.items?.$ref, "#/definitions/StickerResponse");
    assert.equal(response.properties?.guild, undefined, "Route returns guild fields at top level, not under a guild object");

    assert.ok(response.properties?.id, "MemberJoinGuildResponse should include GuildCreateResponse fields");
    assert.ok(response.properties?.name, "MemberJoinGuildResponse should include GuildCreateResponse fields");
    assert.ok(response.properties?.welcome_screen, "MemberJoinGuildResponse should include GuildCreateResponse fields");

    assert.equal(schemas.EmojiResponse?.properties?.guild, undefined, "EmojiResponse must not expose entity relations");
    assert.equal(schemas.RoleResponse?.properties?.guild, undefined, "RoleResponse must not expose entity relations");
    assert.equal(schemas.StickerResponse?.properties?.guild, undefined, "StickerResponse must not expose entity relations");
    assert.equal(schemas.StickerResponse?.properties?.pack, undefined, "StickerResponse must not expose entity relations");
}

describe("MemberJoinGuildResponse schema", () => {
    test("uses public API DTOs instead of TypeORM entity schemas", () => {
        assertMemberJoinGuildResponseUsesApiDtos(readSchemas());
    });
});

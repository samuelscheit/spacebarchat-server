import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toGuildDiscoveryMetadata } from "./GuildDiscoveryMetadata";

describe("guild discovery metadata response", () => {
    it("serializes stored discovery category with client-required metadata defaults", () => {
        assert.deepEqual(toGuildDiscoveryMetadata({ id: "123", primary_category_id: "5", features: ["DISCOVERABLE"], description: "About this guild" }), {
            guild_id: "123",
            primary_category_id: 5,
            category_ids: [5],
            keywords: [],
            emoji_discoverability_enabled: true,
            partner_actioned_timestamp: null,
            partner_application_timestamp: null,
            is_published: true,
            reasons_to_join: [],
            social_links: [],
            about: "About this guild",
        });
    });

    it("uses null category when a guild has not been categorized", () => {
        assert.equal(toGuildDiscoveryMetadata({ id: "123" }).primary_category_id, null);
        assert.deepEqual(toGuildDiscoveryMetadata({ id: "123" }).category_ids, []);
    });
});

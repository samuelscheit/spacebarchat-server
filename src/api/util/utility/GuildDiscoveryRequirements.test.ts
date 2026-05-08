import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCanApplyGuildDiscoveryFeatures, assertCanPublishGuildDiscovery, toGuildDiscoveryRequirements } from "./GuildDiscoveryRequirements";

const rights = (...allowed: string[]) => ({
    has(right: string) {
        return allowed.includes(right);
    },
});

describe("guild discovery requirements response", () => {
    it("uses permissive defaults for a guild that is not admin-excluded", () => {
        assert.deepEqual(toGuildDiscoveryRequirements({ id: "123", discovery_excluded: false }), {
            guild_id: "123",
            safe_environment: true,
            healthy: true,
            health_score_pending: false,
            size: true,
            nsfw_properties: {},
            protected: true,
            sufficient: true,
            sufficient_without_grace_period: true,
            valid_rules_channel: true,
            retention_healthy: true,
            engagement_healthy: true,
            age: true,
            minimum_age: 0,
            health_score: {
                avg_nonnew_participators: 0,
                avg_nonnew_communicators: 0,
                num_intentful_joiners: 0,
                perc_ret_w1_intentful: 0,
            },
            minimum_size: 0,
        });
    });

    it("reports admin-excluded guilds as insufficient for discovery", () => {
        const response = toGuildDiscoveryRequirements({ id: "123", discovery_excluded: true });

        assert.equal(response.safe_environment, false);
        assert.equal(response.protected, false);
        assert.equal(response.sufficient, false);
        assert.equal(response.sufficient_without_grace_period, false);
        assert.equal(response.healthy, true);
        assert.equal(response.size, true);
        assert.equal(response.valid_rules_channel, true);
    });

    it("returns independent health score objects", () => {
        const first = toGuildDiscoveryRequirements({ id: "123" });
        const second = toGuildDiscoveryRequirements({ id: "456" });

        assert.notEqual(first.health_score, second.health_score);
        first.health_score.avg_nonnew_participators = 10;
        assert.equal(second.health_score.avg_nonnew_participators, 0);
    });

    it("allows publishing when the user has discovery rights and the guild is not excluded", () => {
        assert.doesNotThrow(() => assertCanPublishGuildDiscovery({ features: ["COMMUNITY"], discovery_excluded: false }, rights("SELF_ADD_DISCOVERABLE")));
    });

    it("allows instance guild managers to publish without self-publish rights", () => {
        assert.doesNotThrow(() => assertCanPublishGuildDiscovery({ features: ["COMMUNITY"], discovery_excluded: false }, rights("MANAGE_GUILDS")));
    });

    it("rejects publishing without discovery rights", () => {
        assert.throws(() => assertCanPublishGuildDiscovery({ features: ["COMMUNITY"], discovery_excluded: false }, rights()), /SELF_ADD_DISCOVERABLE/);
    });

    it("rejects self-publishing admin-excluded guilds", () => {
        assert.throws(() => assertCanPublishGuildDiscovery({ features: ["COMMUNITY"], discovery_excluded: true }, rights("SELF_ADD_DISCOVERABLE")), /SELF_ADD_DISCOVERABLE/);
    });

    it("does not require discovery rights for keeping or removing discoverability", () => {
        assert.doesNotThrow(() => assertCanApplyGuildDiscoveryFeatures({ features: ["DISCOVERABLE"] }, ["COMMUNITY", "DISCOVERABLE"], rights()));
        assert.doesNotThrow(() => assertCanApplyGuildDiscoveryFeatures({ features: ["COMMUNITY", "DISCOVERABLE"] }, ["COMMUNITY"], rights()));
    });

    it("requires discovery rights when feature updates add discoverability", () => {
        assert.throws(() => assertCanApplyGuildDiscoveryFeatures({ features: ["COMMUNITY"] }, ["COMMUNITY", "DISCOVERABLE"], rights()), /SELF_ADD_DISCOVERABLE/);
    });
});

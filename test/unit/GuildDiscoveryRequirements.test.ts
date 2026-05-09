import assert from "node:assert/strict";
import test from "node:test";
import { toGuildDiscoveryRequirements } from "@spacebar/api";
import { ajv } from "@spacebar/schemas";

test("toGuildDiscoveryRequirements returns the current eligible requirements contract", () => {
    const requirements = toGuildDiscoveryRequirements({ id: "123", discovery_excluded: false });

    assert.deepEqual(requirements, {
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
    assert.equal(ajv.validate("GuildDiscoveryRequirementsResponse", requirements), true, JSON.stringify(ajv.errors));
});

test("toGuildDiscoveryRequirements uses the requested guild id", () => {
    assert.equal(toGuildDiscoveryRequirements({ id: "987654321" }).guild_id, "987654321");
});

test("toGuildDiscoveryRequirements marks admin-excluded guilds as insufficient", () => {
    const requirements = toGuildDiscoveryRequirements({ id: "123", discovery_excluded: true });

    assert.equal(requirements.safe_environment, false);
    assert.equal(requirements.protected, false);
    assert.equal(requirements.sufficient, false);
    assert.equal(requirements.sufficient_without_grace_period, false);
    assert.equal(ajv.validate("GuildDiscoveryRequirementsResponse", requirements), true, JSON.stringify(ajv.errors));
});

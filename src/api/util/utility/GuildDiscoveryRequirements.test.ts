import assert from "node:assert/strict";
import test from "node:test";
import { ajv } from "../../../schemas/Validator";
import { toGuildDiscoveryRequirements } from "./GuildDiscoveryRequirements";

test("toGuildDiscoveryRequirements returns the current permissive requirements contract", () => {
    const requirements = toGuildDiscoveryRequirements("123");

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
    assert.equal(toGuildDiscoveryRequirements("987654321").guild_id, "987654321");
});

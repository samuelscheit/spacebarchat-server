import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { flattenSubscriptionPlans, getSubscriptionPlansForSku, type SubscriptionPlan } from "./#sku_id/subscription-plans.js";

function createPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
    return {
        id: "custom-plan",
        name: "Custom Monthly",
        interval: 1,
        interval_count: 1,
        tax_inclusive: true,
        sku_id: "custom-sku",
        currency: "usd",
        price: 123,
        price_tier: null,
        ...overrides,
    };
}

describe("published listing SKU subscription plans", () => {
    it("returns built-in subscription plans for known Discord-compatible SKUs", () => {
        const plans = getSubscriptionPlansForSku("521847234246082599");

        assert.equal(plans.length, 3);
        assert.deepEqual(
            plans.map((plan) => plan.id),
            ["642251038925127690", "511651880837840896", "511651885459963904"],
        );
    });

    it("returns configured custom plans for custom-only SKUs", () => {
        const customPlan = createPlan();

        assert.deepEqual(getSubscriptionPlansForSku("custom-sku", [customPlan]), [customPlan]);
    });

    it("appends configured custom plans to built-in plans for the same SKU", () => {
        const customPlan = createPlan({ id: "custom-tier", sku_id: "521847234246082599" });

        const plans = getSubscriptionPlansForSku("521847234246082599", [customPlan]);

        assert.equal(plans.length, 4);
        assert.equal(plans.at(-1), customPlan);
    });

    it("ignores configured custom plans for other SKUs", () => {
        const plans = getSubscriptionPlansForSku("custom-sku", [createPlan({ sku_id: "other-sku" })]);

        assert.deepEqual(plans, []);
    });

    it("flattens legacy nested built-in plan arrays before responding", () => {
        const plans = getSubscriptionPlansForSku("978380684370378762");

        assert.equal(plans.length, 1);
        assert.equal(plans[0].id, "978380692553465866");
        assert.equal(Array.isArray(plans[0]), false);
    });

    it("recursively flattens plan-like arrays", () => {
        const firstPlan = createPlan({ id: "first" });
        const secondPlan = createPlan({ id: "second" });

        assert.deepEqual(flattenSubscriptionPlans([[firstPlan], [[secondPlan]]]), [firstPlan, secondPlan]);
    });
});

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import express from "express";
import { ConfigValue, StoreConfiguration, StoreSubscriptionPlanConfiguration } from "@spacebar/util";
import subscriptionPlansRouter, { getSubscriptionPlansForSku, type SubscriptionPlan } from "../../src/api/routes/store/published-listings/skus/#sku_id/subscription-plans";

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

async function requestSubscriptionPlans(path: string) {
    const app = express();
    app.use("/:sku_id/subscription-plans", subscriptionPlansRouter);

    const server = createServer(app);

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");

        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            body: await response.text(),
            status: response.status,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
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

    it("returns no plans for unknown SKUs without matching custom configuration", () => {
        assert.deepEqual(getSubscriptionPlansForSku("missing-sku"), []);
    });

    it("keeps legacy Premium Tier 0 built-in data as a flat plan array", () => {
        const plans = getSubscriptionPlansForSku("978380684370378762");

        assert.equal(plans.length, 1);
        assert.equal(plans[0].id, "978380692553465866");
        assert.equal(Array.isArray(plans[0]), false);
    });

    it("responds with flat built-in plans from the mounted route", async () => {
        const response = await requestSubscriptionPlans("/978380684370378762/subscription-plans/");
        const body = JSON.parse(response.body) as SubscriptionPlan[];

        assert.equal(response.status, 200);
        assert.equal(body.length, 1);
        assert.equal(body[0].id, "978380692553465866");
        assert.equal(Array.isArray(body[0]), false);
    });

    it("responds 404 for invalid SKU route requests", async () => {
        const response = await requestSubscriptionPlans("/missing-sku/subscription-plans/");

        assert.equal(response.status, 404);
    });
});

describe("store subscription plan configuration", () => {
    it("is available on the default ConfigValue", () => {
        const config = new ConfigValue();

        assert.ok(config.store instanceof StoreConfiguration);
        assert.deepEqual(config.store.customSubscriptionPlans, []);
    });

    it("documents defaults for custom subscription plans", () => {
        const plan = new StoreSubscriptionPlanConfiguration();

        assert.equal(plan.interval, 1);
        assert.equal(plan.interval_count, 1);
        assert.equal(plan.tax_inclusive, true);
        assert.equal(plan.currency, "usd");
        assert.equal(plan.price, 0);
        assert.equal(plan.price_tier, null);
    });
});

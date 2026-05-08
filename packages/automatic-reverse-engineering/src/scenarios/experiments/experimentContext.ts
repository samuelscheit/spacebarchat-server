import { defineFeature } from "../feature.js";

const scenarioId = "experiments.visible_context";

export const experimentContext = defineFeature({
    id: scenarioId,
    title: "Record startup experiment and feature context",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["experiments", "feature-flags", "gateway"],
    expected: {
        gateway: [
            { direction: "received", event: "READY", step_id: "load-experiment-context" },
            { direction: "received", event: "READY_SUPPLEMENTAL", step_id: "load-experiment-context" },
        ],
    },
    async run(ctx) {
        await ctx.step("load-experiment-context", "Load startup experiment context", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
            await ctx.expectGateway({ direction: "received", event: "READY" });
            await ctx.expectGateway({ direction: "received", event: "READY_SUPPLEMENTAL" });
        });
    },
});

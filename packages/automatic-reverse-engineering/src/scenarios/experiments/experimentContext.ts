import { clickRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "experiments.visible_context";

export const experimentContext = defineFeature({
    id: scenarioId,
    title: "Record visible experiment context",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["experiments", "feature-flags", "http"],
    expected: {
        http: [
            { method: "GET", route: "/experiments", step_id: "load-experiment-context" },
            { method: "GET", route: "/guilds/{guild_id}/experiments", step_id: "load-experiment-context" },
        ],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open fixture channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("load-experiment-context", "Open visible experiment context", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /experiments|feature flags/i });
            await ctx.expectNetwork({ method: "GET", route: "/experiments" });
        });
    },
});

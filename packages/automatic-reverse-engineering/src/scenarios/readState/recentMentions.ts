import { clickRole, clickText } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "read_state.recent_mentions";

export const recentMentions = defineFeature({
    id: scenarioId,
    title: "Open recent mentions",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["read-state", "mentions", "inbox", "http"],
    expected: {
        http: [{ method: "GET", route: "/users/@me/mentions", step_id: "open-recent-mentions" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("open-recent-mentions", "Open recent mentions", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /inbox|mentions/i });
            await clickText(ctx, scenarioId, /mentions/i);
            await ctx.expectNetwork({ method: "GET", route: "/users/@me/mentions" });
        });
    },
});

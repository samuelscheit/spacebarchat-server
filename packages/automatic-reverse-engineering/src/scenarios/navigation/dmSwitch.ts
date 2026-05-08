import { defineFeature } from "../feature.js";

const scenarioId = "navigation.dm_switch";

export const dmSwitch = defineFeature({
    id: scenarioId,
    title: "Switch to a direct message",
    requiredFixtures: ["channels.dm", "users.dm_peer"],
    tags: ["navigation", "direct-messages", "http"],
    expected: {
        http: [{ method: "GET", route: "/channels/{channel_id}", step_id: "switch-dm" }],
    },
    async run(ctx) {
        await ctx.step("switch-dm", "Switch to DM", async () => {
            await ctx.gotoChannel("dm");
            await ctx.expectReady();
            await ctx.expectNetwork({ method: "GET", route: "/channels/{channel_id}" });
        });
    },
});

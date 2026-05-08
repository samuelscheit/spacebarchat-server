import { defineFeature } from "../feature.js";

export const channelSwitch = defineFeature({
    id: "navigation.channel_switch",
    title: "Switch text channels",
    requiredFixtures: ["guild", "channels.general", "channels.secondary"],
    tags: ["navigation", "channels", "http"],
    expected: {
        http: [{ method: "GET", route: "/channels/{channel_id}/messages", step_id: "switch-channel" }],
    },
    async run(ctx) {
        await ctx.step("open-general", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("switch-channel", "Switch to secondary channel", async () => {
            await ctx.gotoChannel("secondary");
            await ctx.expectReady();
            await ctx.expectNetwork({ method: "GET", route: "/channels/{channel_id}/messages" });
        });
    },
});

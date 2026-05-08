import { clickRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "navigation.guild_switch";

export const guildSwitch = defineFeature({
    id: scenarioId,
    title: "Switch guilds",
    requiredFixtures: ["guild", "guilds.secondary"],
    tags: ["navigation", "guilds", "http", "gateway"],
    expected: {
        http: [{ method: "POST", route: "/guilds/{guild_id}/migrate-command-scope", step_id: "switch-guild" }],
        gateway: [{ direction: "received", event: "CHANNEL_INFO", step_id: "switch-guild" }],
    },
    async run(ctx) {
        await ctx.step("open-primary", "Open primary guild", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("switch-guild", "Switch to secondary guild", async () => {
            await clickRole(ctx, scenarioId, "treeitem", { name: /secondary guild/i });
            await ctx.expectReady();
            await ctx.expectNetwork({ method: "POST", route: "/guilds/{guild_id}/migrate-command-scope" });
            await ctx.expectGateway({ direction: "received", event: "CHANNEL_INFO" });
        });
    },
});

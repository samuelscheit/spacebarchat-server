import { fillRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "search.message.basic";

export const messageSearchBasic = defineFeature({
    id: scenarioId,
    title: "Search guild messages",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["search", "messages", "http"],
    expected: {
        http: [{ method: "GET", route: "/guilds/{guild_id}/messages/search", step_id: "search-messages" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("search-messages", "Search messages", async () => {
            await fillRole(ctx, scenarioId, "combobox", { name: /search/i }, `dm-test-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "GET", route: "/guilds/{guild_id}/messages/search" });
        });
    },
});

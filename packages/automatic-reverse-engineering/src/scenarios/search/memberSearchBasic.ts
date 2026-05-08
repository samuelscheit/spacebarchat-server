import { clickRole, pressKey, typeText } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "search.member.basic";

export const memberSearchBasic = defineFeature({
    id: scenarioId,
    title: "Search guild members",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["search", "members", "gateway"],
    expected: {
        gateway: [
            { direction: "sent", opcode: 8, step_id: "search-members" },
            { direction: "received", event: "GUILD_MEMBERS_CHUNK", step_id: "search-members" },
        ],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("search-members", "Search members", async () => {
            await clickRole(ctx, scenarioId, "textbox", { name: /message #general/i });
            await typeText(ctx, scenarioId, "@blue");
            await ctx.expectGateway({ direction: "sent", opcode: 8 });
            await ctx.expectGateway({ direction: "received", event: "GUILD_MEMBERS_CHUNK" });
            await pressKey(ctx, scenarioId, "ControlOrMeta+A");
            await pressKey(ctx, scenarioId, "Backspace");
        });
    },
});

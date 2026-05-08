import { clickRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "voice.deafen_toggle";

export const voiceDeafenToggle = defineFeature({
    id: scenarioId,
    title: "Toggle voice deafen",
    requiredFixtures: ["guild", "channels.voice"],
    tags: ["voice", "gateway"],
    expected: {
        gateway: [{ direction: "sent", opcode: 4, step_id: "toggle-deafen" }],
    },
    async run(ctx) {
        await ctx.step("join-voice", "Join voice channel", async () => {
            await ctx.gotoChannel("voice");
            await clickRole(ctx, scenarioId, "button", { name: /join voice/i });
            await ctx.expectGateway({ direction: "sent", opcode: 4 });
        });

        await ctx.step("toggle-deafen", "Toggle deafen", async () => {
            await pressKey(ctx, scenarioId, "ControlOrMeta+Shift+D");
            await ctx.expectGateway({ direction: "sent", opcode: 4 });
        });
    },
});

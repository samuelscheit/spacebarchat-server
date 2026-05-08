import { clickRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "voice.disconnect.basic";

export const voiceDisconnectBasic = defineFeature({
    id: scenarioId,
    title: "Disconnect from a voice channel",
    requiredFixtures: ["guild", "channels.voice"],
    tags: ["voice", "gateway"],
    expected: {
        gateway: [
            { direction: "sent", opcode: 4, step_id: "join-voice" },
            { direction: "received", event: "VOICE_STATE_UPDATE", step_id: "join-voice" },
            { direction: "sent", opcode: 4, step_id: "disconnect-voice" },
            { direction: "received", event: "VOICE_STATE_UPDATE", step_id: "disconnect-voice" },
        ],
    },
    async run(ctx) {
        await ctx.step("join-voice", "Join voice channel", async () => {
            await ctx.gotoChannel("voice");
            await ctx.expectGateway({ direction: "sent", opcode: 4 });
            await ctx.expectGateway({ direction: "received", event: "VOICE_STATE_UPDATE" });
        });

        await ctx.step("disconnect-voice", "Disconnect from voice channel", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /disconnect|leave (?:call|voice)/i });
            await ctx.expectGateway({ direction: "sent", opcode: 4 });
            await ctx.expectGateway({ direction: "received", event: "VOICE_STATE_UPDATE" });
        });
    },
});

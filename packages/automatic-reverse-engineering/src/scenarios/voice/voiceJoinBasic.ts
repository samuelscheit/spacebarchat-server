import { defineFeature } from "../feature.js";

export const voiceJoinBasic = defineFeature({
    id: "voice.join.basic",
    title: "Join a voice channel",
    requiredFixtures: ["guild", "channels.voice"],
    tags: ["voice", "gateway"],
    expected: {
        gateway: [
            { direction: "sent", opcode: 4, step_id: "join-voice" },
            { direction: "received", event: "VOICE_STATE_UPDATE", step_id: "join-voice" },
        ],
    },
    async run(ctx) {
        await ctx.step("join-voice", "Join voice channel", async () => {
            await ctx.gotoChannel("voice");
            await ctx.expectGateway({ direction: "sent", opcode: 4 });
            await ctx.expectGateway({ direction: "received", event: "VOICE_STATE_UPDATE" });
        });
    },
});

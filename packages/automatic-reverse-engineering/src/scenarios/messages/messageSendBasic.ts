import { fillRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.send.basic";

export const messageSendBasic = defineFeature({
    id: scenarioId,
    title: "Send a plain text message",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["messages", "http", "gateway"],
    expected: {
        http: [
            {
                method: "POST",
                route: "/channels/{channel_id}/messages",
                step_id: "send-message",
            },
        ],
        gateway: [
            {
                direction: "received",
                event: "MESSAGE_CREATE",
                step_id: "send-message",
            },
        ],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("send-message", "Send plain message", async () => {
            await fillRole(ctx, scenarioId, "textbox", {}, `dm-test-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({
                method: "POST",
                route: "/channels/{channel_id}/messages",
            });
            await ctx.expectGateway({
                direction: "received",
                event: "MESSAGE_CREATE",
            });
        });
    },
});

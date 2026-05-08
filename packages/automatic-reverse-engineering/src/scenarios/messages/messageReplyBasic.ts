import { clickText, fillRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.reply.basic";

export const messageReplyBasic = defineFeature({
    id: scenarioId,
    title: "Reply to a message",
    requiredFixtures: ["guild", "channels.general", "messages.reply_target"],
    tags: ["messages", "reply", "http", "gateway"],
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/messages", step_id: "send-reply" }],
        gateway: [{ direction: "received", event: "MESSAGE_CREATE", step_id: "send-reply" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("send-reply", "Send reply", async () => {
            await clickText(ctx, scenarioId, /reply/i);
            await fillRole(ctx, scenarioId, "textbox", {}, `dm-reply-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_CREATE" });
        });
    },
});

import { clickRole, clickSelector, pressKey, typeText } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "expressions.picker.basic";
const grinningEmojiSelector = '[data-name="grinning"]';

export const expressionPickerBasic = defineFeature({
    id: scenarioId,
    title: "Send a Unicode emoji from the expression picker",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["expressions", "emoji", "messages", "http", "gateway"],
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/messages", step_id: "send-emoji" }],
        gateway: [{ direction: "received", event: "MESSAGE_CREATE", step_id: "send-emoji" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("open-expression-picker", "Open expression picker", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /emoji|expression/i });
        });

        await ctx.step("send-emoji", "Send emoji message", async () => {
            await clickSelector(ctx, scenarioId, grinningEmojiSelector);
            await typeText(ctx, scenarioId, ` dm-emoji-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_CREATE" });
        });
    },
});

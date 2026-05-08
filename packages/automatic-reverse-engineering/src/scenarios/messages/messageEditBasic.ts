import { clickText, fillRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.edit.basic";

export const messageEditBasic = defineFeature({
    id: scenarioId,
    title: "Edit a plain text message",
    requiredFixtures: ["guild", "channels.general", "messages.edit_target"],
    tags: ["messages", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["messages.edit_target"],
    },
    expected: {
        http: [{ method: "PATCH", route: "/channels/{channel_id}/messages/{message_id}", step_id: "edit-message" }],
        gateway: [{ direction: "received", event: "MESSAGE_UPDATE", step_id: "edit-message" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("edit-message", "Edit message", async () => {
            await clickText(ctx, scenarioId, /edit/i);
            await fillRole(ctx, scenarioId, "textbox", {}, `dm-edit-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "PATCH", route: "/channels/{channel_id}/messages/{message_id}" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_UPDATE" });
        });
    },
});

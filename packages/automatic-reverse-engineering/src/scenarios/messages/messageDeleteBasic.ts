import { clickRole, clickText } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.delete.basic";

export const messageDeleteBasic = defineFeature({
    id: scenarioId,
    title: "Delete a message",
    requiredFixtures: ["guild", "channels.general", "messages.delete_target"],
    tags: ["messages", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["messages.delete_target"],
    },
    expected: {
        http: [{ method: "DELETE", route: "/channels/{channel_id}/messages/{message_id}", step_id: "delete-message" }],
        gateway: [{ direction: "received", event: "MESSAGE_DELETE", step_id: "delete-message" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("delete-message", "Delete message", async () => {
            await clickText(ctx, scenarioId, /delete/i);
            await clickRole(ctx, scenarioId, "button", { name: /delete/i });
            await ctx.expectNetwork({ method: "DELETE", route: "/channels/{channel_id}/messages/{message_id}" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_DELETE" });
        });
    },
});

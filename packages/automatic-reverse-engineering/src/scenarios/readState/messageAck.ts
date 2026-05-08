import { clickRole, contextClickRole, contextClickSelector } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "read_state.message_ack";

export const messageAck = defineFeature({
    id: scenarioId,
    title: "Mark channel read after an unread message boundary",
    requiredFixtures: ["guild", "channels.general", "messages.read_target"],
    tags: ["read-state", "messages", "http"],
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/ack", step_id: "ack-message" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("prepare-unread", "Create unread message boundary", async () => {
            await contextClickSelector(ctx, scenarioId, `[id="message-content-${ctx.fixture("messages.read_target")}"]`);
            await clickRole(ctx, scenarioId, "menuitem", { name: /mark (?:as )?unread/i });
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/ack" });
        });

        await ctx.step("ack-message", "Mark channel read", async () => {
            await contextClickRole(ctx, scenarioId, "link", { name: /general \(text channel\)/i });
            await clickRole(ctx, scenarioId, "menuitem", { name: /mark as read/i });
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/ack" });
        });
    },
});

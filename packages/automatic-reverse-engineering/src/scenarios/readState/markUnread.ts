import { clickRole, contextClickSelector } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "read_state.mark_unread";

export const markUnread = defineFeature({
    id: scenarioId,
    title: "Mark a channel unread",
    requiredFixtures: ["guild", "channels.general", "messages.read_target"],
    tags: ["read-state", "messages", "http"],
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/ack", step_id: "mark-unread" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("mark-unread", "Mark unread", async () => {
            await contextClickSelector(ctx, scenarioId, `[id="message-content-${ctx.fixture("messages.read_target")}"]`);
            await clickRole(ctx, scenarioId, "menuitem", { name: /mark (?:as )?unread/i });
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/ack" });
        });
    },
});

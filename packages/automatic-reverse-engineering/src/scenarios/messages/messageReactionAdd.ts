import { clickText } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.reaction.add";

export const messageReactionAdd = defineFeature({
    id: scenarioId,
    title: "Add a reaction to a message",
    requiredFixtures: ["guild", "channels.general", "messages.react_target"],
    tags: ["messages", "reactions", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["messages.react_target"],
    },
    expected: {
        http: [{ method: "PUT", route: "/channels/{channel_id}/messages/{message_id}/reactions/{emoji}/@me", step_id: "add-reaction" }],
        gateway: [{ direction: "received", event: "MESSAGE_REACTION_ADD", step_id: "add-reaction" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("add-reaction", "Add reaction", async () => {
            await clickText(ctx, scenarioId, /add reaction/i);
            await clickText(ctx, scenarioId, "👍");
            await ctx.expectNetwork({ method: "PUT", route: "/channels/{channel_id}/messages/{message_id}/reactions/{emoji}/@me" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_REACTION_ADD" });
        });
    },
});

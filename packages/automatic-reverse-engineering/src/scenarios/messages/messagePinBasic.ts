import { clickRole, contextClickSelector } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.pin.basic";

export const messagePinBasic = defineFeature({
    id: scenarioId,
    title: "Pin a message",
    requiredFixtures: ["guild", "channels.general", "messages.pin_target"],
    tags: ["messages", "pins", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["messages.pin_target"],
    },
    expected: {
        http: [{ method: "PUT", route: "/channels/{channel_id}/messages/pins/{message_id}", step_id: "pin-message" }],
        gateway: [{ direction: "received", event: "CHANNEL_PINS_UPDATE", step_id: "pin-message" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("pin-message", "Pin message", async () => {
            await contextClickSelector(ctx, scenarioId, `[id="message-content-${ctx.fixture("messages.pin_target")}"]`);
            await clickRole(ctx, scenarioId, "menuitem", { name: /^pin message$/i });
            await clickRole(ctx, scenarioId, "button", { name: /pin it/i });
            await ctx.expectNetwork({ method: "PUT", route: "/channels/{channel_id}/messages/pins/{message_id}" });
            await ctx.expectGateway({ direction: "received", event: "CHANNEL_PINS_UPDATE" });
        });
    },
});

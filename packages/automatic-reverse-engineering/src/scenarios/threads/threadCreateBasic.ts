import { clickRole, contextClickText, fillFirstSelector, fillRole, pressKey } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "thread.create.basic";

export const threadCreateBasic = defineFeature({
    id: scenarioId,
    title: "Create a public thread from a message",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["threads", "channels", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["channels.general"],
    },
    expected: {
        http: [
            { method: "POST", route: "/channels/{channel_id}/messages", step_id: "seed-thread-source-message" },
            { method: "POST", route: "/channels/{channel_id}/messages/{message_id}/threads", step_id: "create-thread" },
        ],
        gateway: [
            { direction: "received", event: "MESSAGE_CREATE", step_id: "seed-thread-source-message" },
            { direction: "received", event: "THREAD_CREATE", step_id: "create-thread" },
        ],
    },
    async run(ctx) {
        const runLabel = `${ctx.run_id}-${Date.now()}`;
        const sourceMessage = `dm-thread-source-${runLabel}`;

        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("seed-thread-source-message", "Send source message for thread", async () => {
            await fillRole(ctx, scenarioId, "textbox", { name: /message #general/i }, sourceMessage);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages", timeoutMs: 30000 });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_CREATE", timeoutMs: 30000 });
        });

        await ctx.step("create-thread", "Create thread", async () => {
            await contextClickText(ctx, scenarioId, sourceMessage, { exact: true });
            await clickRole(ctx, scenarioId, "menuitem", { name: /^create thread$/i });
            await fillFirstSelector(ctx, scenarioId, 'input:not([type="file"])', `dm-thread-${runLabel}`);
            await fillRole(ctx, scenarioId, "textbox", { name: /enter a message/i }, `dm-thread-starter-${runLabel}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages/{message_id}/threads", timeoutMs: 30000 });
            await ctx.expectGateway({ direction: "received", event: "THREAD_CREATE", timeoutMs: 30000 });
        });
    },
});

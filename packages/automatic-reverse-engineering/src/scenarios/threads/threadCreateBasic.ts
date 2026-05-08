import { clickRole, fillRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "thread.create.basic";

export const threadCreateBasic = defineFeature({
    id: scenarioId,
    title: "Create a public thread",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["threads", "channels", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["channels.general"],
    },
    expected: {
        http: [{ method: "POST", route: "/channels/{channel_id}/threads", step_id: "create-thread" }],
        gateway: [{ direction: "received", event: "THREAD_CREATE", step_id: "create-thread" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("create-thread", "Create thread", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /create thread/i });
            await fillRole(ctx, scenarioId, "textbox", { name: /thread name/i }, `dm-thread-${ctx.run_id}`);
            await clickRole(ctx, scenarioId, "button", { name: /create/i });
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/threads" });
            await ctx.expectGateway({ direction: "received", event: "THREAD_CREATE" });
        });
    },
});

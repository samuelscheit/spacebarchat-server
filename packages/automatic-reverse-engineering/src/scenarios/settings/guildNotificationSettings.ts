import { clickRole, clickSelector } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "settings.guild_notifications";

export const guildNotificationSettings = defineFeature({
    id: scenarioId,
    title: "Change guild notification settings",
    requiredFixtures: ["guild"],
    tags: ["settings", "notifications", "http", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["guild"],
    },
    expected: {
        http: [{ method: "PATCH", route: "/users/@me/guilds/settings", step_id: "change-notifications" }],
    },
    async run(ctx) {
        await ctx.step("open-notifications", "Open notification settings", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
            await clickRole(ctx, scenarioId, "button", { name: /server actions/i });
            await clickRole(ctx, scenarioId, "menuitem", { name: /^notification settings$/i });
        });

        await ctx.step("change-notifications", "Change notification setting", async () => {
            await clickSelector(ctx, scenarioId, 'label.radioGroupOption__64e61:has-text("Only @mentions")');
            await clickRole(ctx, scenarioId, "button", { name: /^done$/i });
            await ctx.expectNetwork({ method: "PATCH", route: "/users/@me/guilds/settings", timeoutMs: 30000 });
        });
    },
});

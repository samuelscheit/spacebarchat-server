import { clickRole } from "../actions.js";
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
        http: [{ method: "PATCH", route: "/users/@me/guilds/{guild_id}/settings", step_id: "change-notifications" }],
    },
    async run(ctx) {
        await ctx.step("open-notifications", "Open notification settings", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /notification settings/i });
        });

        await ctx.step("change-notifications", "Change notification setting", async () => {
            await clickRole(ctx, scenarioId, "radio", { name: /only mentions/i });
            await clickRole(ctx, scenarioId, "button", { name: /done|save/i });
            await ctx.expectNetwork({ method: "PATCH", route: "/users/@me/guilds/{guild_id}/settings" });
        });
    },
});

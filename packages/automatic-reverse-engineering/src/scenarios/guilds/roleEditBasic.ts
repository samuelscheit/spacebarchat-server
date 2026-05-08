import { clickRole, fillRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "guild.role.edit.basic";

export const roleEditBasic = defineFeature({
    id: scenarioId,
    title: "Edit a guild role",
    requiredFixtures: ["guild", "roles.feature_test_role"],
    tags: ["guild-settings", "roles", "http", "gateway", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["roles.feature_test_role"],
    },
    expected: {
        http: [{ method: "PATCH", route: "/guilds/{guild_id}/roles/{role_id}", step_id: "edit-role" }],
        gateway: [{ direction: "received", event: "GUILD_ROLE_UPDATE", step_id: "edit-role" }],
    },
    async run(ctx) {
        await ctx.step("open-settings", "Open role settings", async () => {
            await clickRole(ctx, scenarioId, "button", { name: /server settings/i });
            await clickRole(ctx, scenarioId, "tab", { name: /roles/i });
        });

        await ctx.step("edit-role", "Edit role", async () => {
            await fillRole(ctx, scenarioId, "textbox", { name: /role name/i }, `feature-test-${ctx.run_id}`);
            await clickRole(ctx, scenarioId, "button", { name: /save/i });
            await ctx.expectNetwork({ method: "PATCH", route: "/guilds/{guild_id}/roles/{role_id}" });
            await ctx.expectGateway({ direction: "received", event: "GUILD_ROLE_UPDATE" });
        });
    },
});

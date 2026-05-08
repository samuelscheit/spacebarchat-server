import { clickRole, clickRoleAtIndex, clickText, fillSelector } from "../actions.js";
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
            await ctx.gotoChannel("general");
            await ctx.expectReady();
            await clickRole(ctx, scenarioId, "button", { name: /server actions/i });
            await clickRole(ctx, scenarioId, "menuitem", { name: /^server settings$/i });
            await clickText(ctx, scenarioId, "Roles", { exact: true });
            await clickRoleAtIndex(ctx, scenarioId, "button", { name: /^edit$/i }, 1);
        });

        await ctx.step("edit-role", "Edit role", async () => {
            await fillSelector(ctx, scenarioId, 'input[placeholder=""]', `feature-test-${ctx.run_id}`);
            await clickRole(ctx, scenarioId, "button", { name: /save changes/i });
            await ctx.expectNetwork({ method: "PATCH", route: "/guilds/{guild_id}/roles/{role_id}" });
            await ctx.expectGateway({ direction: "received", event: "GUILD_ROLE_UPDATE" });
        });
    },
});

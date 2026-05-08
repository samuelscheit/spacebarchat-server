import { clickRole } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "channel.permission.edit";

export const channelPermissionEdit = defineFeature({
    id: scenarioId,
    title: "Edit channel permissions",
    requiredFixtures: ["guild", "channels.general", "roles.feature_test_role"],
    tags: ["channel-settings", "permissions", "http", "destructive"],
    safety: {
        destructive: true,
        requiredDisposableFixtures: ["channels.general", "roles.feature_test_role"],
    },
    expected: {
        http: [{ method: "PUT", route: "/channels/{channel_id}/permissions/{role_id}", step_id: "edit-permission" }],
    },
    async run(ctx) {
        await ctx.step("open-channel-settings", "Open channel permission settings", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
            await clickRole(ctx, scenarioId, "button", { name: /edit channel/i });
            await clickRole(ctx, scenarioId, "tab", { name: /permissions/i });
        });

        await ctx.step("edit-permission", "Edit permission overwrite", async () => {
            await clickRole(ctx, scenarioId, "checkbox", { name: /send messages/i });
            await clickRole(ctx, scenarioId, "button", { name: /save/i });
            await ctx.expectNetwork({ method: "PUT", route: "/channels/{channel_id}/permissions/{role_id}" });
        });
    },
});

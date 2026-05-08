import { defineFeature } from "../feature.js";

export const idleSession = defineFeature({
    id: "bootstrap.idle.session",
    title: "Authenticated app bootstrap and idle baseline",
    requiredFixtures: ["guild", "channels.general"],
    tags: ["bootstrap", "baseline", "gateway", "http"],
    async run(ctx) {
        await ctx.step("open-channel", "Open baseline channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });
    },
});

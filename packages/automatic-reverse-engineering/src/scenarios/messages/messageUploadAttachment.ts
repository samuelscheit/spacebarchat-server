import { fillRole, pressKey, setInputFilesBySelector } from "../actions.js";
import { defineFeature } from "../feature.js";

const scenarioId = "message.upload.attachment";

export const messageUploadAttachment = defineFeature({
    id: scenarioId,
    title: "Upload an attachment",
    requiredFixtures: ["guild", "channels.general", "files.small_attachment"],
    tags: ["messages", "attachments", "http", "gateway"],
    expected: {
        http: [
            { method: "POST", route: "/channels/{channel_id}/attachments", step_id: "upload-attachment" },
            { method: "POST", route: "/channels/{channel_id}/messages", step_id: "upload-attachment" },
        ],
        gateway: [{ direction: "received", event: "MESSAGE_CREATE", step_id: "upload-attachment" }],
    },
    async run(ctx) {
        await ctx.step("open-channel", "Open general channel", async () => {
            await ctx.gotoChannel("general");
            await ctx.expectReady();
        });

        await ctx.step("upload-attachment", "Upload attachment", async () => {
            await setInputFilesBySelector(ctx, scenarioId, "input[type=file]", ctx.fixture("files.small_attachment"));
            await fillRole(ctx, scenarioId, "textbox", {}, `dm-upload-${ctx.run_id}`);
            await pressKey(ctx, scenarioId, "Enter");
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/attachments" });
            await ctx.expectNetwork({ method: "POST", route: "/channels/{channel_id}/messages" });
            await ctx.expectGateway({ direction: "received", event: "MESSAGE_CREATE" });
        });
    },
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

function indexOf(source: string, fragment: string): number {
    const index = source.indexOf(fragment);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function assertBefore(source: string, first: string, second: string): void {
    assert.ok(indexOf(source, first) < indexOf(source, second), `Expected ${first} to appear before ${second}`);
}

describe("message media permission route integration", () => {
    test("message edit resolves retained attachment references before handleMessage", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/#message_id/index.ts");

        assertBefore(source, "const existingAttachmentsById = new Map", "const new_message = await handleMessage(");
        assertBefore(source, "if (isNewMessagePayloadAttachment(attachment)) return attachment;", "const retained = existingAttachmentsById.get(attachment.id);");
        assertBefore(source, 'throw new HTTPError("Unknown attachment", 400);', "const new_message = await handleMessage(");
    });

    test("normal message create checks media permissions before thread side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/index.ts");

        assertBefore(source, "assertMessagePayloadPermissions(req.permission!, { ...body, attachments, uploadedFileCount: files.length });", "ThreadMember.create({");
        assertBefore(source, "assertMessagePayloadPermissions(req.permission!, { ...body, attachments, uploadedFileCount: files.length });", 'event: "THREAD_MEMBERS_UPDATE"');
        assertBefore(source, "assertMessagePayloadPermissions(req.permission!, { ...body, attachments, uploadedFileCount: files.length });", "uploadFile(`/attachments/");
    });

    test("thread starter message checks media permissions before thread side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/threads.ts");

        assert.equal(source.includes("const messagePermission = await getPermission"), false);
        assertBefore(
            source,
            "assertMessagePayloadPermissions(req.permission!, { ...body.message, attachments: messageAttachments, uploadedFileCount: files.length });",
            "Channel.createThreadChannel(",
        );
        assertBefore(
            source,
            "assertMessagePayloadPermissions(req.permission!, { ...body.message, attachments: messageAttachments, uploadedFileCount: files.length });",
            "uploadFile(`/attachments/",
        );
    });

    test("webhooks check media permissions before success responses and upload side effects", () => {
        const source = readSource("src/api/util/handlers/Webhook.ts");

        assert.notEqual(indexOf(source, "if (!wait && !res.headersSent)"), -1);
        assert.equal(source.match(/acknowledgeNoWait\(\);\n\s+return;/g)?.length, 2);
        assertBefore(source, "assertMessagePayloadPermissions(permissions, messagePayload);", "    acknowledgeNoWait();\n\n    try {");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, messagePayload);", "uploadWebhookMessageFiles(sendChannel.id, messageId, files)");
    });

    test("interaction callbacks check media permissions before success and message side effects", () => {
        const source = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");

        assert.notEqual(indexOf(source, "InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE"), -1);
        assert.notEqual(indexOf(source, "InteractionCallbackType.DEFERRED_UPDATE_MESSAGE"), -1);
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "clearTimeout(interaction.timeout);");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", 'event: "INTERACTION_SUCCESS"');
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "await sendMessage({");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "message.embeds = body.data.embeds || [];");
    });

    test("interaction PONG callback only uses shared acknowledgement cleanup", () => {
        const source = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");

        assert.notEqual(indexOf(source, "case InteractionCallbackType.PONG:"), -1);
        assert.notEqual(indexOf(source, "PONG acknowledges ping interactions without creating or updating messages."), -1);
        assertBefore(source, "case InteractionCallbackType.PONG:", "pendingInteractions.delete(interactionId);");
        assertBefore(source, "case InteractionCallbackType.PONG:", "res.sendStatus(204);");
    });

    test("component media extraction is shared between permission gates and message handling", () => {
        const messageSource = readSource("src/api/util/handlers/Message.ts");
        const permissionSource = readSource("src/api/util/utility/MessagePayloadPermissions.ts");

        assert.notEqual(indexOf(permissionSource, "hasMessagePayloadComponentMedia(opts.components)"), -1);
        assertBefore(messageSource, "const medias = collectMessageComponentMedia(components);", "processMedia(m, messageId");
    });
});

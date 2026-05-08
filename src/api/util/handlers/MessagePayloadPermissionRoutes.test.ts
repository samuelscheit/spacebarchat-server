import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { acknowledgeDeferredMessageUpdateInteraction } from "./InteractionCallbackState.ts";

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
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "await acknowledgeDeferredMessageUpdateInteraction(");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", 'event: "INTERACTION_SUCCESS"');
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "await sendMessage({");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "message.embeds = body.data.embeds || [];");
    });

    test("deferred message updates acknowledge without scheduling an unreachable failure", async () => {
        const source = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");
        const stateSource = readSource("src/api/util/handlers/InteractionCallbackState.ts");
        const deferredUpdateAcknowledgement = stateSource.slice(indexOf(stateSource, "export async function acknowledgeDeferredMessageUpdateInteraction"));
        const deferredRouteAcknowledgement = source.slice(
            indexOf(source, "await acknowledgeDeferredMessageUpdateInteraction("),
            indexOf(source, "clearTimeout(interaction.timeout);"),
        );

        let originalPendingTimeoutFired = false;
        const originalSetTimeout = globalThis.setTimeout;
        const pendingTimeout = originalSetTimeout(() => {
            originalPendingTimeoutFired = true;
        }, 25);
        const installedTimeouts: NodeJS.Timeout[] = [];
        const scheduledDelays: Array<number | undefined> = [];
        const pending = new Map([
            [
                "interaction-1",
                {
                    timeout: pendingTimeout,
                    userId: "user-1",
                    nonce: "nonce-1",
                },
            ],
        ]);
        const emittedEvents: unknown[] = [];

        globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
            scheduledDelays.push(delay);
            const installedTimeout = originalSetTimeout(() => callback(...args), 60_000);
            installedTimeouts.push(installedTimeout);
            return installedTimeout;
        }) as typeof setTimeout;

        try {
            await acknowledgeDeferredMessageUpdateInteraction("interaction-1", pending.get("interaction-1")!, pending, (event) => {
                emittedEvents.push(event);
            });
        } finally {
            globalThis.setTimeout = originalSetTimeout;
            for (const timeout of installedTimeouts) clearTimeout(timeout);
        }

        await new Promise((resolve) => {
            originalSetTimeout(resolve, 50);
        });

        assert.equal(originalPendingTimeoutFired, false);
        assert.deepEqual(scheduledDelays, []);
        assert.deepEqual(emittedEvents, [
            {
                event: "INTERACTION_SUCCESS",
                user_id: "user-1",
                data: {
                    id: "interaction-1",
                    nonce: "nonce-1",
                },
            },
        ]);
        assert.equal(pending.has("interaction-1"), false);
        assert.equal(source.includes("InteractionFailureReason"), false);
        assert.equal(stateSource.includes("setTimeout"), false);
        assertBefore(deferredUpdateAcknowledgement, "clearTimeout(interaction.timeout);", "await emitEvent({");
        assertBefore(deferredUpdateAcknowledgement, "await emitEvent({", "pendingInteractions.delete(interactionId);");
        assertBefore(source, "body.type === InteractionCallbackType.DEFERRED_UPDATE_MESSAGE", "await acknowledgeDeferredMessageUpdateInteraction(");
        assertBefore(deferredRouteAcknowledgement, "await acknowledgeDeferredMessageUpdateInteraction(", "res.sendStatus(204);");
        assertBefore(deferredRouteAcknowledgement, "await acknowledgeDeferredMessageUpdateInteraction(", "return;");
    });

    test("component media extraction is shared between permission gates and message handling", () => {
        const messageSource = readSource("src/api/util/handlers/Message.ts");
        const permissionSource = readSource("src/api/util/utility/MessagePayloadPermissions.ts");

        assert.notEqual(indexOf(permissionSource, "hasMessagePayloadComponentMedia(opts.components)"), -1);
        assertBefore(messageSource, "const medias = collectMessageComponentMedia(components);", "processMedia(m, messageId");
    });
});

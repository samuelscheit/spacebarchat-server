import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { acknowledgeDeferredMessageUpdateInteraction } from "./InteractionCallbackState";

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

function indexOf(source: string, fragment: string): number {
    const index = source.indexOf(fragment);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function lastIndexOf(source: string, fragment: string): number {
    const index = source.lastIndexOf(fragment);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function assertBefore(source: string, first: string, second: string): void {
    assert.ok(indexOf(source, first) < indexOf(source, second), `Expected ${first} to appear before ${second}`);
}

describe("message media permission route integration", () => {
    test("message handler validates payload limits before persistence side effects", () => {
        const source = readSource("src/api/util/handlers/Message.ts");

        assertBefore(source, "assertMessagePayloadLimits(opts);", "const isEdit = isMessageEditOperation(opts);");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "const handle = (!isEdit || opts.process_component_media === true)");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "const channel = await Channel.findOneOrFail");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "const message = Message.create({");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "await processMessageOptionAttachments(opts, message);");
    });

    test("message edit resolves retained attachment references before handleMessage", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/#message_id/index.ts");

        assertBefore(source, "normalizeMessageEditBodyAttachments(body, message.attachments);", "const new_message = await handleMessage(");
        assertBefore(source, "buildMessageEditComponentProcessingOptions(normalizedBody);", "const new_message = await handleMessage(");
        assert.notEqual(indexOf(source, "...componentProcessingOptions,"), -1);
    });

    test("normal message create checks media permissions before thread side effects", () => {
        const routeSource = readSource("src/api/routes/channels/#channel_id/messages/index.ts");
        const source = readSource("src/api/util/handlers/ChannelMessageCreateRoute.ts");

        assert.notEqual(indexOf(routeSource, 'router.post("/", ...createMessageRouteHandlers);'), -1);
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

    test("thread creation dynamically scopes public and private thread permissions before side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/threads.ts");

        assert.equal(source.includes('permission: "CREATE_PUBLIC_THREADS"'), false);
        assert.notEqual(indexOf(source, 'permission: "VIEW_CHANNEL"'), -1);
        assert.notEqual(indexOf(source, "const threadType = resolveThreadCreationType(body, channel);"), -1);
        assert.notEqual(indexOf(source, "req.permission!.hasThrow(getThreadCreationPermission(threadType));"), -1);
        assertBefore(source, "const threadType = resolveThreadCreationType(body, channel);", "req.permission!.hasThrow(getThreadCreationPermission(threadType));");
        assertBefore(source, "req.permission!.hasThrow(getThreadCreationPermission(threadType));", "Channel.createThreadChannel(");
        assertBefore(source, "req.permission!.hasThrow(getThreadCreationPermission(threadType));", "uploadFile(`/attachments/");
        assert.notEqual(indexOf(source, "if (shouldSendThreadCreatedMessage(threadType, channel))"), -1);
        assert.equal(source.includes("if (body.type !== ChannelType.GUILD_PRIVATE_THREAD"), false);
    });

    test("thread routes no longer reference the superseded PR 876 implementation", () => {
        const standaloneThreadSource = readSource("src/api/routes/channels/#channel_id/threads.ts");
        const messageThreadSource = readSource("src/api/routes/channels/#channel_id/messages/#message_id/threads.ts");

        assert.equal(standaloneThreadSource.includes("github.com/spacebarchat/server/pull/876"), false);
        assert.equal(messageThreadSource.includes("github.com/spacebarchat/server/pull/876"), false);
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
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "clearTimeout(interaction.timeout);");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "clearTimeout(interaction.timeout);");
        assertBefore(source, "assertMessagePayloadLimits(body.data);", 'event: "INTERACTION_SUCCESS"');
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "await acknowledgeDeferredMessageUpdateInteraction(");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "await acknowledgeDeferredMessageUpdateInteraction(");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", 'event: "INTERACTION_SUCCESS"');
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "await sendMessage({");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "await sendMessage({");
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "const updatedMessage = await handleMessage(");
        assertBefore(source, "assertMessagePayloadPermissions(permissions, body.data);", "const updatedMessage = await handleMessage(");
        const updateMessageCase = source.slice(
            indexOf(source, "case InteractionCallbackType.UPDATE_MESSAGE:"),
            indexOf(source, "case InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT:"),
        );
        assertBefore(updateMessageCase, "normalizeMessageEditBodyAttachments(body.data, message.attachments);", "const updatedMessage = await handleMessage(");
        assertBefore(updateMessageCase, "buildMessageEditComponentProcessingOptions(normalizedBody);", "const updatedMessage = await handleMessage(");
        assertBefore(updateMessageCase, "buildMessageEditHandleMessageOptions(message, normalizedBody", 'event: "MESSAGE_UPDATE"');
        assertBefore(updateMessageCase, "const updatedMessage = await handleMessage(", 'event: "MESSAGE_UPDATE"');
        assertBefore(updateMessageCase, "attachment_user_id: interaction.applicationId,", "attachment_channel_ids: [channelId],");
        assertBefore(updateMessageCase, 'event: "MESSAGE_UPDATE"', "                break;");
        assert.notEqual(indexOf(updateMessageCase, "...componentProcessingOptions,"), -1);
        assert.equal(updateMessageCase.includes("// TODO"), false);
        assert.equal(updateMessageCase.includes("message.embeds = body.data.embeds || []"), false);
    });

    test("interaction PONG callback only uses shared acknowledgement cleanup", () => {
        const source = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");

        const pongCase = indexOf(source, "case InteractionCallbackType.PONG:");
        const nextCase = indexOf(source, "case InteractionCallbackType.ACKNOWLEDGE:");
        const defaultCase = indexOf(source, "default:");
        const pongBody = source.slice(pongCase, nextCase);
        assert.match(pongBody, /^\s*case InteractionCallbackType\.PONG:\s*\/\/ PONG acknowledges ping interactions without creating or updating messages\.\s*break;\s*$/);

        const sharedCleanup = lastIndexOf(source, "pendingInteractions.delete(interactionId);");
        const sharedNoContentResponse = lastIndexOf(source, "res.sendStatus(204);");
        assert.ok(pongCase < sharedCleanup, "Expected PONG to reach the shared pending interaction cleanup");
        assert.ok(defaultCase < sharedCleanup, "Expected shared cleanup to live after the callback-type switch");
        assert.ok(sharedCleanup < sharedNoContentResponse, "Expected shared cleanup to run before the shared 204 response");
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
        assert.equal(stateSource.includes("nonce ??"), false);
        assert.equal(stateSource.includes("setTimeout"), false);
        assertBefore(deferredUpdateAcknowledgement, "clearTimeout(interaction.timeout);", "await emitEvent({");
        assertBefore(deferredUpdateAcknowledgement, "await emitEvent({", "pendingInteractions.delete(interactionId);");
        assertBefore(source, "body.type === InteractionCallbackType.DEFERRED_UPDATE_MESSAGE", "await acknowledgeDeferredMessageUpdateInteraction(");
        assertBefore(deferredRouteAcknowledgement, "await acknowledgeDeferredMessageUpdateInteraction(", "res.sendStatus(204);");
        assertBefore(deferredRouteAcknowledgement, "await acknowledgeDeferredMessageUpdateInteraction(", "return;");
    });

    test("message edit attachment resolution is shared by normal edits and interaction callbacks", () => {
        const channelEditSource = readSource("src/api/routes/channels/#channel_id/messages/#message_id/index.ts");
        const interactionCallbackSource = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");
        const attachmentSource = readSource("src/api/util/utility/MessageEditAttachments.ts");

        assert.notEqual(indexOf(channelEditSource, "normalizeMessageEditBodyAttachments(body, message.attachments);"), -1);
        assert.notEqual(indexOf(interactionCallbackSource, "normalizeMessageEditBodyAttachments(body.data, message.attachments);"), -1);
        assert.notEqual(indexOf(channelEditSource, "buildMessageEditComponentProcessingOptions(normalizedBody)"), -1);
        assert.notEqual(indexOf(interactionCallbackSource, "buildMessageEditComponentProcessingOptions(normalizedBody)"), -1);
        assert.notEqual(indexOf(attachmentSource, "const existingAttachmentsById = new Map"), -1);
        assert.notEqual(indexOf(attachmentSource, "if (isNewMessagePayloadAttachment(attachment)) return attachment;"), -1);
        assert.notEqual(indexOf(attachmentSource, 'throw new HTTPError("Unknown attachment", 400);'), -1);
    });

    test("webhook message edits share explicit component processing state with normal edits", () => {
        const source = readSource("src/api/util/handlers/WebhookMessage.ts");

        assertBefore(source, "buildMessageEditComponentProcessingOptions(body);", "buildMessageEditHandleMessageOptions(message, body");
        assert.notEqual(indexOf(source, "...componentProcessingOptions,"), -1);
    });

    test("component media extraction is shared between permission gates and message handling", () => {
        const messageSource = readSource("src/api/util/handlers/Message.ts");
        const permissionSource = readSource("src/api/util/utility/MessagePayloadPermissions.ts");

        assert.notEqual(indexOf(permissionSource, "hasMessagePayloadComponentMedia(opts.components)"), -1);
        assertBefore(messageSource, "const medias = collectMessageComponentMedia(components);", "processMedia(m, message,");
        assertBefore(
            messageSource,
            "const handle = (!isEdit || opts.process_component_media === true) && opts.components ? handleComps(opts.components, opts.flags || 0) : undefined;",
            "if (isEdit && handle) {",
        );
        assertBefore(messageSource, "delete messageOptions.process_component_media;", "const message = Message.create({");
        assertBefore(messageSource, "if (isEdit && handle) {", "return message;");
    });
});

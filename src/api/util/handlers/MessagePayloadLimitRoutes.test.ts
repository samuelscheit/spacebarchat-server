import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function readSource(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

function indexOf(source: string, fragment: string, fromIndex = 0): number {
    const index = source.indexOf(fragment, fromIndex);
    assert.notEqual(index, -1, `Expected source to contain: ${fragment}`);
    return index;
}

function assertBefore(source: string, first: string, second: string): void {
    assert.ok(indexOf(source, first) < indexOf(source, second), `Expected ${first} to appear before ${second}`);
}

function assertOrdered(source: string, fragments: string[]): void {
    let cursor = 0;
    for (const fragment of fragments) {
        cursor = indexOf(source, fragment, cursor) + fragment.length;
    }
}

describe("message payload limit route integration", () => {
    test("normal message create validates dynamic limits before message side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/index.ts");

        assertOrdered(source, ["router.post(", "validateMessagePayloadLimits,", "const channel = await Channel.findOneOrFail({"]);
        assertOrdered(source, ["router.post(", "validateMessagePayloadLimits,", "ThreadMember.create({"]);
        assertOrdered(source, ["router.post(", "validateMessagePayloadLimits,", "uploadFile(`/attachments/"]);
        assertOrdered(source, ["router.post(", "validateMessagePayloadLimits,", "const message = await handleMessage({"]);
    });

    test("message edit validates dynamic limits before loading or rebuilding the message", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/#message_id/index.ts");

        assertOrdered(source, ["router.patch(", "validateMessagePayloadLimits,", "const message = await Message.findOneOrFail({"]);
        assertOrdered(source, ["router.patch(", "validateMessagePayloadLimits,", "const new_message = await handleMessage("]);
    });

    test("backfill message validates dynamic limits before upload and handleMessage side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/messages/#message_id/index.ts");

        assertOrdered(source, ["router.put(", "validateMessagePayloadLimits,", "uploadFile(`/attachments/"]);
        assertOrdered(source, ["router.put(", "validateMessagePayloadLimits,", "const message = await handleMessage({"]);
    });

    test("thread starter validates dynamic limits before thread, upload, and message side effects", () => {
        const source = readSource("src/api/routes/channels/#channel_id/threads.ts");

        assertBefore(source, "if (body.message) assertMessagePayloadLimits(body.message);", "const channel = await Channel.findOneOrFail({");
        assertBefore(source, "if (body.message) assertMessagePayloadLimits(body.message);", "Channel.createThreadChannel(");
        assertBefore(source, "if (body.message) assertMessagePayloadLimits(body.message);", "uploadFile(`/attachments/");
        assertBefore(source, "if (body.message) assertMessagePayloadLimits(body.message);", "const message = await handleMessage({");
    });

    test("webhook execute validates dynamic limits before no-wait acknowledgements, uploads, and message side effects", () => {
        const source = readSource("src/api/util/handlers/Webhook.ts");

        assertBefore(source, "assertMessagePayloadLimits(body);", "acknowledgeNoWait();");
        assertBefore(source, "assertMessagePayloadLimits(body);", "uploadWebhookMessageFiles(sendChannel.id, messageId, files)");
        assertBefore(source, "assertMessagePayloadLimits(body);", "const message = await handleMessage({");
    });

    test("interaction callbacks validate dynamic limits before success events and message mutations", () => {
        const source = readSource("src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts");

        assertBefore(source, "assertMessagePayloadLimits(body.data);", "clearTimeout(interaction.timeout);");
        assertBefore(source, "assertMessagePayloadLimits(body.data);", 'event: "INTERACTION_SUCCESS"');
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "await sendMessage({");
        assertBefore(source, "assertMessagePayloadLimits(body.data);", "message.embeds = body.data.embeds || [];");
    });

    test("handleMessage reuses the shared limit assertion before loading channels or creating entities", () => {
        const source = readSource("src/api/util/handlers/Message.ts");

        assertBefore(source, 'import { assertMessagePayloadLimits } from "../utility/MessagePayloadLimits";', "export async function handleMessage(");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "const channel = await Channel.findOneOrFail({");
        assertBefore(source, "assertMessagePayloadLimits(opts);", "const message = Message.create({");
    });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const CALLBACK_ROUTE = "src/api/routes/interactions/#interaction_id/#interaction_token/callback.ts";

function readRouteSource() {
    return readFileSync(join(process.cwd(), CALLBACK_ROUTE), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `Expected route source to contain ${start}`);

    const endIndex = source.indexOf(end, startIndex);
    assert.notEqual(endIndex, -1, `Expected route source to contain ${end} after ${start}`);

    return source.slice(startIndex, endIndex + end.length);
}

test("UPDATE_MESSAGE interaction callbacks stay implemented", () => {
    const source = readRouteSource();
    const updateMessageCase = sliceBetween(source, "case InteractionCallbackType.UPDATE_MESSAGE:", "break;");

    assert.equal(/todo/i.test(updateMessageCase), false, "implemented UPDATE_MESSAGE branch should not retain a placeholder TODO");
    assert.match(updateMessageCase, /Message\.findOneOrFail\(/);
    assert.match(updateMessageCase, /await handleMessage\(/);
    assert.match(updateMessageCase, /buildMessageEditHandleMessageOptions\(message, body\.data, message\.channel_id, message\.id/);
    assert.match(updateMessageCase, /attachment_user_id: interaction\.userId/);
    assert.match(updateMessageCase, /is_edit: true/);
    assert.match(updateMessageCase, /await updatedMessage\.save\(\);/);
    assert.match(updateMessageCase, /event: "MESSAGE_UPDATE"/);
    assert.match(updateMessageCase, /\.\.\.updatedMessage\.toJSON\(\)/);
    assert.match(updateMessageCase, /postHandleMessage\(updatedMessage\)/);

    const caseStart = source.indexOf("case InteractionCallbackType.UPDATE_MESSAGE:");
    const updateEventIndex = source.indexOf('event: "MESSAGE_UPDATE"', caseStart);
    const cleanupIndex = source.indexOf("pendingInteractions.delete(interactionId);", caseStart);
    const responseIndex = source.indexOf("res.sendStatus(204);", cleanupIndex);

    assert.ok(updateEventIndex > caseStart, "UPDATE_MESSAGE should emit MESSAGE_UPDATE before completing the callback");
    assert.ok(cleanupIndex > updateEventIndex, "pending interaction cleanup should happen after the update event");
    assert.ok(responseIndex > cleanupIndex, "callback should acknowledge only after cleanup");
});

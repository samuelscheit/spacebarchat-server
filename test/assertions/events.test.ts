import assert from "node:assert/strict";
import { test } from "node:test";
import { EventCapture } from "../fixtures/events";
import { assertEvent, assertEventData, assertNoEvent } from "./events";

test("event assertions match routing fields and payload fragments", async () => {
    const capture = new EventCapture();
    capture.record({
        event: "MESSAGE_CREATE",
        channel_id: "channel-fixture",
        data: { id: "message-fixture", content: "hello" },
    });

    const event = assertEvent(capture, { event: "MESSAGE_CREATE", channel_id: "channel-fixture" });
    assert.equal(event.channel_id, "channel-fixture");
    assertEventData(event, { content: "hello" });

    await assertNoEvent(capture, "MESSAGE_DELETE");
});

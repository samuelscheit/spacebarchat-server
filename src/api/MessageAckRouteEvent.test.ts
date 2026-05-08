import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const routeSource = () => readFileSync(join(process.cwd(), "src/api/routes/channels/#channel_id/messages/#message_id/ack.ts"), "utf8");

describe("message acknowledgement route events", () => {
    test("fans acknowledgement events out through the channel route", () => {
        const source = routeSource();
        const emitIndex = source.indexOf('await emitEvent({\n            event: "MESSAGE_ACK"');
        assert.notEqual(emitIndex, -1, "MESSAGE_ACK emit call should exist");

        const emitBlock = source.slice(emitIndex, source.indexOf("} satisfies MessageAckEvent);", emitIndex));
        assert.match(emitBlock, /\n\s+channel_id,\n/);
        assert.doesNotMatch(emitBlock, /\n\s+user_id: req\.user_id,\n/);
    });

    test("keeps the read-state fanout TODO resolved", () => {
        assert.doesNotMatch(routeSource(), /TODO: send read state event to all channel members/);
    });
});

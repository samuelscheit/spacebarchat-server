import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getEventRouteId } from "../../src/gateway/listener/subscriptions";
import { getEventPermissionLookupId } from "../../src/gateway/util/EventPermissions";
import type { MessageAckEvent } from "@spacebar/util";

describe("message acknowledgement event routing", () => {
    test("routes message ACK dispatches through the acknowledged channel", () => {
        const event = {
            event: "MESSAGE_ACK",
            channel_id: "channel-id",
            data: {
                channel_id: "channel-id",
                message_id: "message-id",
                version: 3763,
            },
        } satisfies MessageAckEvent;

        assert.equal(getEventRouteId(event), "channel-id");
        assert.equal("user_id" in event, false);
    });

    test("uses the channel id for message ACK gateway permission checks", () => {
        assert.equal(
            getEventPermissionLookupId("MESSAGE_ACK", {
                channel_id: "channel-id",
            }),
            "channel-id",
        );
    });
});

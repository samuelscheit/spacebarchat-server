import assert from "node:assert/strict";
import { test } from "node:test";
import { emitEvent } from "@spacebar/util";
import { assertEvent, assertEventData } from "../assertions/events";
import { captureEvents } from "./events";

test("captureEvents records process-local events by route id", async () => {
    const capture = await captureEvents("guild-fixture");

    try {
        await emitEvent({
            event: "GUILD_CREATE",
            guild_id: "guild-fixture",
            data: { id: "guild-fixture", name: "Fixture Guild" },
        });

        const event = await capture.waitFor("GUILD_CREATE");
        assert.equal(event.guild_id, "guild-fixture");

        const asserted = assertEvent(capture, { event: "GUILD_CREATE", guild_id: "guild-fixture" });
        assertEventData(asserted, { id: "guild-fixture", name: "Fixture Guild" });
    } finally {
        await capture.stop();
    }
});

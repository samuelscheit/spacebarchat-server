import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { emitEvent, events, listenEvent, SPACEBAR_EVENT_ROUTE } from "./Event";

afterEach(() => {
    events.removeAllListeners(SPACEBAR_EVENT_ROUTE);
    delete process.env.EVENT_TRANSMISSION;
    delete process.env.EVENT_SOCKET_PATH;
});

test("internal spacebar events are routed to the shared config reload listener route", async () => {
    const received: unknown[] = [];
    const cancel = await listenEvent(SPACEBAR_EVENT_ROUTE, (event) => {
        received.push({
            event: event.event,
            spacebar_event_id: event.spacebar_event_id,
            data: event.data,
            origin: event.origin,
        });
    });

    await emitEvent({
        event: "SB_RELOAD_CONFIG",
        spacebar_event_id: SPACEBAR_EVENT_ROUTE,
        data: {},
        origin: "test",
    });
    await cancel();

    assert.deepEqual(received, [
        {
            event: "SB_RELOAD_CONFIG",
            spacebar_event_id: SPACEBAR_EVENT_ROUTE,
            data: {},
            origin: "test",
        },
    ]);
});

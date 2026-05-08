import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { listenEvent, type EventOpts } from "./Event.js";
import { RabbitMQ } from "./RabbitMQ.js";

const originalEventTransmission = process.env.EVENT_TRANSMISSION;

function emitProcessMessage(message: unknown) {
    process.emit("message", message, undefined);
}

afterEach(() => {
    if (originalEventTransmission === undefined) {
        delete process.env.EVENT_TRANSMISSION;
    } else {
        process.env.EVENT_TRANSMISSION = originalEventTransmission;
    }
    RabbitMQ.connection = null;
});

describe("listenEvent process transmission", () => {
    test("delivers well-formed process events for the subscribed id", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const received: EventOpts[] = [];
        const cancel = await listenEvent("guild-1", (event) => received.push(event));

        try {
            emitProcessMessage({
                type: "event",
                id: "guild-1",
                event: {
                    event: "SB_RELOAD_CONFIG",
                    guild_id: "guild-1",
                    data: { reload: true },
                },
            });

            assert.equal(received.length, 1);
            assert.equal(received[0].event, "SB_RELOAD_CONFIG");
            assert.deepEqual(received[0].data, { reload: true });
            assert.equal(typeof received[0].cancel, "function");
        } finally {
            await cancel();
        }
    });

    test("ignores malformed and unrelated process messages", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const received: EventOpts[] = [];
        const cancel = await listenEvent("guild-1", (event) => received.push(event));

        try {
            emitProcessMessage(null);
            emitProcessMessage({});
            emitProcessMessage({ type: "event", id: "guild-1" });
            emitProcessMessage({ type: "event", id: "guild-1", event: { data: {} } });
            emitProcessMessage({ type: "spacebar:startupFailure", serviceName: "API server" });
            emitProcessMessage({ type: "event", id: "guild-2", event: { event: "SB_RELOAD_CONFIG", guild_id: "guild-2" } });

            assert.deepEqual(received, []);
        } finally {
            await cancel();
        }
    });

    test("cancel removes the registered process message listener", async () => {
        process.env.EVENT_TRANSMISSION = "process";
        const initialListenerCount = process.listenerCount("message");
        const cancel = await listenEvent("guild-1", () => undefined);

        assert.equal(process.listenerCount("message"), initialListenerCount + 1);

        await cancel();

        assert.equal(process.listenerCount("message"), initialListenerCount);
    });
});

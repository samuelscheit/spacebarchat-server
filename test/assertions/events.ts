import assert from "node:assert/strict";
import type { Event } from "@spacebar/util";
import { EventCapture, EventPredicate, toEventPredicate } from "../fixtures/events";

export interface ExpectedEvent {
    event?: string;
    guild_id?: string;
    channel_id?: string;
    user_id?: string;
    session_id?: string;
}

export function assertEvent(capture: EventCapture, expected: ExpectedEvent | EventPredicate): Event {
    const predicate = typeof expected === "function" ? expected : expectedEventPredicate(expected);
    return capture.expectOne(predicate);
}

export function assertEventData(event: Event, expectedData: Record<string, unknown>) {
    assert.equal(typeof event.data, "object");
    assert.notEqual(event.data, null);

    for (const [key, value] of Object.entries(expectedData)) {
        assert.deepEqual(event.data[key], value);
    }
}

export async function assertNoEvent(capture: EventCapture, eventOrPredicate: string | EventPredicate, timeoutMs = 25) {
    const predicate = toEventPredicate(eventOrPredicate);
    assert.equal(capture.events.some(predicate), false);

    await assert.rejects(capture.waitFor(predicate, timeoutMs), /Timed out waiting for event/);
}

function expectedEventPredicate(expected: ExpectedEvent): EventPredicate {
    return (event) => {
        if (expected.event && event.event !== expected.event) return false;
        if (expected.guild_id && event.guild_id !== expected.guild_id) return false;
        if (expected.channel_id && event.channel_id !== expected.channel_id) return false;
        if (expected.user_id && event.user_id !== expected.user_id) return false;
        if (expected.session_id && event.session_id !== expected.session_id) return false;
        return true;
    };
}

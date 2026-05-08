import assert from "node:assert/strict";
import { Event, EVENT, EventOpts, listenEvent } from "@spacebar/util";

export type EventPredicate = (event: Event) => boolean;
type CancelListener = () => Promise<void>;

interface Waiter {
    predicate: EventPredicate;
    resolve: (event: Event) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class EventCapture {
    public readonly events: Event[] = [];
    private readonly cancelListeners: CancelListener[];
    private readonly waiters: Waiter[] = [];
    private stopped = false;

    constructor(cancelListeners: CancelListener[] = []) {
        this.cancelListeners = cancelListeners;
    }

    addCancelListener(cancel: CancelListener) {
        this.cancelListeners.push(cancel);
    }

    record(event: Event) {
        if (this.stopped) return;

        this.events.push(event);
        const matched = this.waiters.filter((waiter) => waiter.predicate(event));
        for (const waiter of matched) {
            clearTimeout(waiter.timeout);
            this.waiters.splice(this.waiters.indexOf(waiter), 1);
            waiter.resolve(event);
        }
    }

    waitFor(eventOrPredicate: EVENT | string | EventPredicate, timeoutMs = 250): Promise<Event> {
        const predicate = toEventPredicate(eventOrPredicate);
        const existing = this.events.find(predicate);
        if (existing) return Promise.resolve(existing);

        return new Promise((resolve, reject) => {
            const waiter: Waiter = {
                predicate,
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.waiters.splice(this.waiters.indexOf(waiter), 1);
                    reject(new Error(`Timed out waiting for event after ${timeoutMs}ms`));
                }, timeoutMs),
            };
            this.waiters.push(waiter);
        });
    }

    expectOne(eventOrPredicate: EVENT | string | EventPredicate): Event {
        const predicate = toEventPredicate(eventOrPredicate);
        const matches = this.events.filter(predicate);
        assert.equal(matches.length, 1);
        return matches[0];
    }

    async stop() {
        if (this.stopped) return;
        this.stopped = true;

        for (const waiter of this.waiters.splice(0)) {
            clearTimeout(waiter.timeout);
            waiter.reject(new Error("Event capture stopped"));
        }

        await Promise.all(this.cancelListeners.splice(0).map((cancel) => cancel()));
    }
}

export async function captureEvents(routeIds: string | string[]): Promise<EventCapture> {
    const ids = Array.isArray(routeIds) ? routeIds : [routeIds];
    const capture = new EventCapture();

    for (const id of ids) {
        const cancel = await listenEvent(id, (event) => capture.record(stripListenerFields(event)));
        capture.addCancelListener(cancel);
    }

    return capture;
}

function stripListenerFields(event: EventOpts): Event {
    const { acknowledge, cancel, channel, ...payload } = event;
    void acknowledge;
    void cancel;
    void channel;
    return payload;
}

export function toEventPredicate(eventOrPredicate: EVENT | string | EventPredicate): EventPredicate {
    if (typeof eventOrPredicate === "function") return eventOrPredicate;
    return (event) => event.event === eventOrPredicate;
}

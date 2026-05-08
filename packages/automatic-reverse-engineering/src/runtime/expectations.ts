import { CaptureEvent, HttpMethod } from "../types.js";

export interface NetworkExpectation {
    method: string;
    route: string;
    step_id?: string;
    timeoutMs?: number;
}

export interface GatewayExpectation {
    direction: "sent" | "received";
    event?: string;
    opcode?: number;
    step_id?: string;
    timeoutMs?: number;
}

type PendingExpectation = {
    matches(event: CaptureEvent): boolean;
    resolve(): void;
    reject(error: Error): void;
    timer: NodeJS.Timeout;
};

export class RuntimeExpectationTracker {
    private readonly events: CaptureEvent[] = [];
    private readonly pending = new Set<PendingExpectation>();

    observe(event: CaptureEvent): void {
        this.events.push(event);
        for (const expectation of Array.from(this.pending)) {
            if (expectation.matches(event)) {
                clearTimeout(expectation.timer);
                this.pending.delete(expectation);
                expectation.resolve();
            }
        }
    }

    waitForNetwork(expectation: NetworkExpectation): Promise<void> {
        return this.waitFor((event) => matchesNetwork(event, expectation), `Timed out waiting for ${expectation.method} ${expectation.route}`, expectation.timeoutMs);
    }

    waitForGateway(expectation: GatewayExpectation): Promise<void> {
        const label = expectation.event ?? `opcode ${expectation.opcode ?? "unknown"}`;
        return this.waitFor((event) => matchesGateway(event, expectation), `Timed out waiting for ${expectation.direction} Gateway ${label}`, expectation.timeoutMs);
    }

    private waitFor(matches: (event: CaptureEvent) => boolean, message: string, timeoutMs = 5000): Promise<void> {
        if (this.events.some(matches)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const pending: PendingExpectation = {
                matches,
                resolve,
                reject,
                timer: setTimeout(() => {
                    this.pending.delete(pending);
                    reject(new Error(message));
                }, timeoutMs),
            };
            this.pending.add(pending);
        });
    }
}

function matchesNetwork(event: CaptureEvent, expectation: NetworkExpectation): boolean {
    return (
        event.kind === "http.response" &&
        (typeof expectation.step_id === "undefined" || event.step_id === expectation.step_id) &&
        (event.method ?? "").toUpperCase() === (expectation.method.toUpperCase() as HttpMethod) &&
        event.normalized_route === expectation.route &&
        event.status > 0
    );
}

function matchesGateway(event: CaptureEvent, expectation: GatewayExpectation): boolean {
    return (
        (event.kind === "ws.frame.sent" || event.kind === "ws.frame.received") &&
        (typeof expectation.step_id === "undefined" || event.step_id === expectation.step_id) &&
        event.direction === expectation.direction &&
        (typeof expectation.event === "undefined" || event.gateway_event === expectation.event) &&
        (typeof expectation.opcode === "undefined" || event.opcode === expectation.opcode)
    );
}

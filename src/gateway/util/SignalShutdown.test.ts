import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { installSignalShutdown } from "./SignalShutdown";

class TestSignalProcess {
    handlers = new Map<string, Set<(signal: NodeJS.Signals) => void | Promise<void>>>();
    exits: number[] = [];

    on(signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void | Promise<void>) {
        const handlers = this.handlers.get(signal) ?? new Set<(signal: NodeJS.Signals) => void | Promise<void>>();
        handlers.add(handler);
        this.handlers.set(signal, handlers);
        return this as unknown as NodeJS.Process;
    }

    off(signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void | Promise<void>) {
        const handlers = this.handlers.get(signal);
        for (const registeredHandler of handlers ?? []) {
            if (registeredHandler === handler) handlers?.delete(registeredHandler);
        }
        if (handlers && !handlers.size) this.handlers.delete(signal);
        return this as unknown as NodeJS.Process;
    }

    exit(code?: number | string | null) {
        this.exits.push(Number(code ?? 0));
        return undefined as never;
    }

    async emitSignal(signal: NodeJS.Signals) {
        await Promise.all([...(this.handlers.get(signal) ?? [])].map((handler) => Promise.resolve(handler(signal))));
    }
}

describe("installSignalShutdown", () => {
    test("registers shutdown signals and awaits stop before exiting", async () => {
        const signalProcess = new TestSignalProcess();
        let stopped = false;

        installSignalShutdown(async () => {
            stopped = true;
        }, signalProcess);

        assert.deepEqual([...signalProcess.handlers.keys()], ["SIGINT", "SIGTERM", "SIGQUIT"]);

        await signalProcess.emitSignal("SIGTERM");

        assert.equal(stopped, true);
        assert.deepEqual(signalProcess.exits, [0]);
    });

    test("replaces an existing installation for the same process", async () => {
        const signalProcess = new TestSignalProcess();
        const stops: string[] = [];

        installSignalShutdown(async () => {
            stops.push("first");
        }, signalProcess);
        installSignalShutdown(async () => {
            stops.push("second");
        }, signalProcess);

        assert.deepEqual(
            [...signalProcess.handlers.values()].map((handlers) => handlers.size),
            [1, 1, 1],
        );

        await signalProcess.emitSignal("SIGINT");

        assert.deepEqual(stops, ["second"]);
        assert.deepEqual(signalProcess.exits, [0]);
    });

    test("returns a disposer that removes installed handlers", async () => {
        const signalProcess = new TestSignalProcess();
        let stopped = false;

        const dispose = installSignalShutdown(async () => {
            stopped = true;
        }, signalProcess);

        dispose();
        assert.equal(signalProcess.handlers.size, 0);

        await signalProcess.emitSignal("SIGQUIT");

        assert.equal(stopped, false);
        assert.deepEqual(signalProcess.exits, []);
    });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { installSignalShutdown } from "./SignalShutdown";

describe("installSignalShutdown", () => {
    test("registers shutdown signals and awaits stop before exiting", async () => {
        const handlers = new Map<string, (signal: NodeJS.Signals) => Promise<void>>();
        const exits: number[] = [];
        let stopped = false;

        installSignalShutdown(
            async () => {
                stopped = true;
            },
            {
                once: (signal: string, handler: (...args: unknown[]) => void) => {
                    handlers.set(signal, handler as (signal: NodeJS.Signals) => Promise<void>);
                    return {} as NodeJS.Process;
                },
                exit: (code) => {
                    exits.push(Number(code ?? 0));
                    return undefined as never;
                },
            },
        );

        assert.deepEqual([...handlers.keys()], ["SIGINT", "SIGTERM", "SIGQUIT"]);

        await handlers.get("SIGTERM")!("SIGTERM");

        assert.equal(stopped, true);
        assert.deepEqual(exits, [0]);
    });
});

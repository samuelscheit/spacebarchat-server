import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sleep as sleepFromExtensionsBarrel } from "../../src/util/util/extensions";
import { sleep } from "../../src/util/util/extensions/Sleep";

describe("extension helpers", () => {
    test("sleep is exported through the extension barrel", () => {
        assert.equal(sleepFromExtensionsBarrel, sleep);
    });

    test("sleep schedules a timeout for the requested duration", async (t) => {
        const originalSetTimeout = globalThis.setTimeout;
        let scheduledDelay: number | undefined;
        let scheduledCallback: (() => void) | undefined;

        t.after(() => {
            globalThis.setTimeout = originalSetTimeout;
        });

        globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
            scheduledDelay = delay;
            scheduledCallback = () => callback(...args);
            return 0 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;

        let resolved = false;
        const promise = sleepFromExtensionsBarrel(42).then(() => {
            resolved = true;
        });

        assert.equal(scheduledDelay, 42);
        await Promise.resolve();
        assert.equal(resolved, false);

        assert.ok(scheduledCallback);
        scheduledCallback();
        await promise;
        assert.equal(resolved, true);
    });
});

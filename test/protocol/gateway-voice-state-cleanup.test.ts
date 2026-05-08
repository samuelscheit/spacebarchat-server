import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanupStaleVoiceStates } from "../../src/gateway/util/Utils";

describe("gateway voice-state startup cleanup", () => {
    test("clears stale voice-state rows instead of preserving null-channel rows", async () => {
        let clearCalls = 0;
        let updateCalls = 0;
        const repository = {
            async clear() {
                clearCalls += 1;
            },
            async update() {
                updateCalls += 1;
                throw new Error("startup cleanup must not retain stale voice state rows");
            },
        };

        await cleanupStaleVoiceStates(repository);

        assert.equal(clearCalls, 1);
        assert.equal(updateCalls, 0);
    });

    test("surfaces clear failures to the startup caller", async () => {
        const failure = new Error("database unavailable");

        await assert.rejects(
            cleanupStaleVoiceStates({
                async clear() {
                    throw failure;
                },
            }),
            failure,
        );
    });
});

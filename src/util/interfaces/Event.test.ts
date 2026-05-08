import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { READY_SESSION_TYPE, type ReadyEventData } from "./Event";

describe("ReadyEventData", () => {
    test("uses Discord's normal READY session type", () => {
        const sessionType = READY_SESSION_TYPE satisfies ReadyEventData["session_type"];

        assert.equal(sessionType, "normal");
    });
});

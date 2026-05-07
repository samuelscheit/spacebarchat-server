import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createChannelInfoPayload } from "./ChannelInfo";

describe("createChannelInfoPayload", () => {
    test("returns persisted status when status is requested", () => {
        assert.deepEqual(createChannelInfoPayload({ id: "1", status: "gaming" }, ["status"]), {
            id: "1",
            status: "gaming",
            voice_start_time: undefined,
        });
    });

    test("returns null status when status is requested but not tracked on channel", () => {
        assert.deepEqual(createChannelInfoPayload({ id: "1" }, ["status"]), {
            id: "1",
            status: null,
            voice_start_time: undefined,
        });
    });

    test("omits status when status is not requested", () => {
        assert.deepEqual(createChannelInfoPayload({ id: "1", status: "gaming" }, []), {
            id: "1",
            status: undefined,
            voice_start_time: undefined,
        });
    });

    test("returns null voice_start_time instead of a synthetic timestamp", () => {
        assert.deepEqual(createChannelInfoPayload({ id: "1", status: "gaming" }, ["voice_start_time"]), {
            id: "1",
            status: undefined,
            voice_start_time: null,
        });
    });

    test("includes both requested fields", () => {
        assert.deepEqual(createChannelInfoPayload({ id: "1", status: null }, ["status", "voice_start_time"]), {
            id: "1",
            status: null,
            voice_start_time: null,
        });
    });
});

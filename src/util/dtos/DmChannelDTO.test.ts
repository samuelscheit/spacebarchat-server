import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getCreateDMChannelResponse } from "./DmChannelCreateResponse";

const DM_CHANNEL_TYPE = 1;
const GROUP_DM_CHANNEL_TYPE = 3;

describe("getCreateDMChannelResponse", () => {
    test("keeps the creator in group DM create responses", () => {
        const channel = {
            id: "channel-id",
            type: GROUP_DM_CHANNEL_TYPE,
            owner_id: "creator-id",
            recipients: [{ id: "creator-id" }, { id: "user-1" }, { id: "user-2" }],
        };

        assert.deepEqual(getCreateDMChannelResponse(channel, "creator-id"), channel);
    });

    test("keeps one-to-one DM create responses unchanged", () => {
        const channel = {
            id: "channel-id",
            type: DM_CHANNEL_TYPE,
            recipients: [{ id: "creator-id" }, { id: "user-1" }],
        };

        assert.deepEqual(getCreateDMChannelResponse(channel, "creator-id"), channel);
    });
});

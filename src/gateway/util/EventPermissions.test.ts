import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getEventPermissionLookupId } from "./EventPermissions";

describe("gateway event permission lookup", () => {
    test("uses the guild id for webhook update permission checks", () => {
        assert.equal(
            getEventPermissionLookupId("WEBHOOKS_UPDATE", {
                channel_id: "channel-id",
                guild_id: "guild-id",
            }),
            "guild-id",
        );
    });

    test("keeps default event permission lookups on the payload id", () => {
        assert.equal(
            getEventPermissionLookupId("CHANNEL_UPDATE", {
                id: "channel-id",
                guild_id: "guild-id",
            }),
            "channel-id",
        );
    });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ThreadMember, ThreadMemberMuteConfig } from "@spacebar/util";

test("ThreadMember.mute_config uses the exported shared interface", () => {
    type EntityMuteConfig = NonNullable<ThreadMember["mute_config"]>;

    const dateConfig: ThreadMemberMuteConfig = {
        end_time: new Date("2026-01-02T03:04:05.000Z"),
        selected_time_window: 60,
    };
    const storedJsonConfig: ThreadMemberMuteConfig = {
        end_time: "2026-01-02T03:04:05.000Z",
        selected_time_window: 60,
    };

    const dateEntityConfig: EntityMuteConfig = dateConfig;
    const storedJsonEntityConfig: EntityMuteConfig = storedJsonConfig;

    assert.equal(dateEntityConfig.selected_time_window, 60);
    assert.equal(dateEntityConfig.end_time instanceof Date ? dateEntityConfig.end_time.toISOString() : dateEntityConfig.end_time, "2026-01-02T03:04:05.000Z");
    assert.equal(storedJsonEntityConfig.end_time, "2026-01-02T03:04:05.000Z");
});

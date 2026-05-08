import test from "node:test";
import assert from "node:assert/strict";
import type { ThreadMember as ThreadMemberEntity } from "../entities/ThreadMember";
import type { ThreadMemberMuteConfig } from "./ThreadMember";

test("thread member entity mute config uses the shared interface", () => {
    type EntityMuteConfig = NonNullable<ThreadMemberEntity["mute_config"]>;

    const entityConfig: EntityMuteConfig = {
        end_time: new Date("2026-01-02T03:04:05.000Z"),
        selected_time_window: 60,
    };
    const sharedConfig: ThreadMemberMuteConfig = entityConfig;

    assert.equal(sharedConfig.selected_time_window, 60);
    assert.equal(sharedConfig.end_time?.toISOString(), "2026-01-02T03:04:05.000Z");
});

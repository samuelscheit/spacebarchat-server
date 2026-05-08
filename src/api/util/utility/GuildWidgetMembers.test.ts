import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Status } from "@spacebar/util";
import { getWidgetMemberStatus } from "./GuildWidgetMembers";

describe("guild widget member helpers", () => {
    const activeSince = new Date("2026-05-08T10:00:00.000Z");
    const recent = new Date("2026-05-08T10:01:00.000Z");
    const stale = new Date("2026-05-08T09:59:59.000Z");

    test("returns the most relevant public widget member status", () => {
        assert.equal(getWidgetMemberStatus([session("idle", recent), session("dnd", recent)], activeSince), "idle");
        assert.equal(getWidgetMemberStatus([session("dnd", recent), session("online", recent)], activeSince), "online");
    });

    test("returns idle and dnd instead of hard-coding online", () => {
        assert.equal(getWidgetMemberStatus([session("idle", recent)], activeSince), "idle");
        assert.equal(getWidgetMemberStatus([session("dnd", recent)], activeSince), "dnd");
    });

    test("excludes sessions that should not appear in public widget members", () => {
        assert.equal(getWidgetMemberStatus([session("online", stale)], activeSince), undefined);
        assert.equal(getWidgetMemberStatus([session("online", recent, true)], activeSince), undefined);
        assert.equal(getWidgetMemberStatus([session("offline", recent)], activeSince), undefined);
        assert.equal(getWidgetMemberStatus([session("invisible", recent)], activeSince), undefined);
        assert.equal(getWidgetMemberStatus([session("unknown", recent)], activeSince), undefined);
    });
});

function session(status: Status, lastSeen: Date, isAdminSession = false) {
    return {
        activities: [],
        getPublicStatus() {
            return status === "invisible" ? "offline" : status;
        },
        is_admin_session: isAdminSession,
        last_seen: lastSeen,
        status,
    };
}

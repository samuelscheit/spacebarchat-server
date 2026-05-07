import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clearAdminAuditEventsForTests, listAdminAuditEvents, recordAdminAuditEvent } from "./audit";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

describe("admin audit events", () => {
    test("records newest activity first with explicit metadata", async () => {
        await clearAdminAuditEventsForTests();

        const first = await recordAdminAuditEvent({
            action: "channel.delete",
            actorId: "operator",
            targetType: "channel",
            targetId: "10",
            status: "succeeded",
            severity: "danger",
            metadata: { detachedChildChannelIds: ["11"], reason: "requested by Trust and Safety" },
        });
        const second = await recordAdminAuditEvent({
            action: "configuration.reload",
            actorId: "operator",
            targetType: "configuration",
            targetId: "database",
            status: "succeeded",
        });

        const listed = await listAdminAuditEvents({ limit: 10, offset: 0 });

        assert.equal(listed.pagination.total, 2);
        assert.equal(listed.items[0].id, second.id);
        assert.equal(listed.items[1].id, first.id);
        assert.equal(listed.items[1].reason, "requested by Trust and Safety");
        assert.deepEqual(listed.items[1].metadata, { detachedChildChannelIds: ["11"], reason: "requested by Trust and Safety" });
    });

    test("filters activity by action, actor, target, and status", async () => {
        await clearAdminAuditEventsForTests();
        await recordAdminAuditEvent({
            action: "user.delete",
            actorId: "operator-a",
            targetType: "user",
            targetId: "100",
            status: "accepted",
            severity: "danger",
        });
        await recordAdminAuditEvent({
            action: "guild.force_join",
            actorId: "operator-b",
            targetType: "guild",
            targetId: "200",
            status: "succeeded",
            severity: "warning",
        });

        assert.equal((await listAdminAuditEvents({ limit: 10, offset: 0, q: "force" })).items.length, 1);
        assert.equal((await listAdminAuditEvents({ limit: 10, offset: 0, q: "operator-a" })).items.length, 1);
        assert.equal((await listAdminAuditEvents({ limit: 10, offset: 0, q: "200" })).items.length, 1);
        assert.equal((await listAdminAuditEvents({ limit: 10, offset: 0, q: "accepted" })).items.length, 1);
    });
});

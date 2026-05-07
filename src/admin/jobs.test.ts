import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clearAdminJobsForTests, createAdminJob, getAdminJob, listAdminJobs, requestAdminJobCancellation } from "./jobs";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

function tick() {
    return new Promise<void>((resolve) => {
        setImmediate(resolve);
    });
}

describe("admin jobs", () => {
    test("runs jobs and exposes progress/result snapshots", async () => {
        await clearAdminJobsForTests();

        const created = await createAdminJob({
            type: "test.job",
            input: { id: "1" },
            createdBy: "operator",
            runner: async (context) => {
                await context.setProgress({ current: 1, total: 2, label: "half" });
                return { ok: true };
            },
        });

        assert.equal(created.status, "queued");

        await tick();
        await tick();

        const completed = await getAdminJob(created.id);
        assert.equal(completed.status, "succeeded");
        assert.deepEqual(completed.result, { ok: true });
        assert.deepEqual(completed.progress, { current: 1, total: 2, label: "half" });
    });

    test("deduplicates starts with the same type and idempotency key", async () => {
        await clearAdminJobsForTests();

        const first = await createAdminJob({
            type: "test.idempotent",
            input: { id: "1" },
            createdBy: "operator",
            idempotencyKey: "same",
            runner: async () => ({ first: true }),
        });
        const second = await createAdminJob({
            type: "test.idempotent",
            input: { id: "2" },
            createdBy: "operator",
            idempotencyKey: "same",
            runner: async () => ({ second: true }),
        });

        assert.equal(second.id, first.id);
        assert.deepEqual(second.input, { id: "1" });
    });

    test("idempotent duplicate starts preserve the original dangerous input", async () => {
        await clearAdminJobsForTests();

        const first = await createAdminJob({
            type: "test.dangerous",
            input: { targetId: "1", reason: "original reason" },
            createdBy: "operator",
            idempotencyKey: "same-dangerous-submit",
            runner: async () => ({ ok: true }),
        });
        const second = await createAdminJob({
            type: "test.dangerous",
            input: { targetId: "2", reason: "changed reason" },
            createdBy: "operator",
            idempotencyKey: "same-dangerous-submit",
            runner: async () => ({ ok: true }),
        });

        assert.equal(second.id, first.id);
        assert.deepEqual(second.input, { targetId: "1", reason: "original reason" });
    });

    test("supports cancellation before queued jobs start", async () => {
        await clearAdminJobsForTests();

        const created = await createAdminJob({
            type: "test.cancel",
            input: {},
            createdBy: "operator",
            runner: async () => ({ shouldNotRun: true }),
        });

        const cancelling = await requestAdminJobCancellation(created.id);
        assert.equal(cancelling.cancelRequested, true);

        await tick();
        await tick();

        assert.equal((await getAdminJob(created.id)).status, "cancelled");
    });

    test("lists jobs with pagination and search metadata", async () => {
        await clearAdminJobsForTests();

        await createAdminJob({
            type: "alpha.cleanup",
            input: {},
            createdBy: "operator-one",
            runner: async () => ({}),
        });
        await createAdminJob({
            type: "beta.cleanup",
            input: {},
            createdBy: "operator-two",
            runner: async () => ({}),
        });

        const firstPage = await listAdminJobs({ limit: 1, offset: 0 });
        assert.equal(firstPage.items.length, 1);
        assert.equal(firstPage.pagination.total, 2);
        assert.equal(firstPage.pagination.limit, 1);
        assert.equal(firstPage.pagination.offset, 0);

        const filtered = await listAdminJobs({ limit: 10, offset: 0, q: "beta" });
        assert.equal(filtered.pagination.total, 1);
        assert.equal(filtered.items[0].type, "beta.cleanup");
    });
});

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { DataSource } from "typeorm";
import { clearAdminAuditEventsForTests, listAdminAuditEvents, recordAdminAuditEvent } from "./audit";
import { clearAdminJobsForTests, createAdminJob, getAdminJob, recoverAdminJobs, registerAdminJobRunner, requestAdminJobCancellation } from "./jobs";
import { AdminJobsAndAuditRecords1778062363001 } from "../util/migration/postgres/1778062363001-AdminJobsAndAuditRecords";

type UtilExports = typeof import("@spacebar/util");

const databaseUrl = process.env.ADMIN_DURABLE_TEST_DATABASE;
const describeDurable = databaseUrl ? describe : describe.skip;
let dataSource: DataSource | null = null;

function utilExports() {
    return require("@spacebar/util") as UtilExports;
}

function databaseModule() {
    return require("../util/util/Database") as typeof import("../util/util/Database") & {
        dbConnection: DataSource | undefined;
    };
}

async function installSchema(source: DataSource) {
    const migration = new AdminJobsAndAuditRecords1778062363001();
    const queryRunner = source.createQueryRunner();
    await queryRunner.connect();
    try {
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_records"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_jobs"`);
        await migration.up(queryRunner);
    } finally {
        await queryRunner.release();
    }
}

async function uninstallSchema(source: DataSource) {
    const queryRunner = source.createQueryRunner();
    await queryRunner.connect();
    try {
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_records"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "admin_jobs"`);
    } finally {
        await queryRunner.release();
    }
}

async function attachDatabase() {
    const util = utilExports();
    const source = new DataSource({
        type: "postgres",
        url: databaseUrl,
        entities: [util.AdminJob, util.AdminAuditRecord],
        synchronize: false,
        logging: false,
    });

    await source.initialize();
    await installSchema(source);
    databaseModule().dbConnection = source;
    dataSource = source;
}

async function detachDatabase() {
    const source = dataSource;
    dataSource = null;
    databaseModule().dbConnection = undefined;

    if (source?.isInitialized) {
        await uninstallSchema(source);
        await source.destroy();
    }
}

async function simulateRestart() {
    const previous = dataSource;
    dataSource = null;
    databaseModule().dbConnection = undefined;
    await previous?.destroy();

    const util = utilExports();
    const source = new DataSource({
        type: "postgres",
        url: databaseUrl,
        entities: [util.AdminJob, util.AdminAuditRecord],
        synchronize: false,
        logging: false,
    });
    await source.initialize();
    databaseModule().dbConnection = source;
    dataSource = source;
}

async function waitForJob(id: string, predicate: (status: string) => boolean) {
    const started = Date.now();
    let last = await getAdminJob(id);

    while (!predicate(last.status)) {
        if (Date.now() - started > 5000) throw new Error(`Timed out waiting for job ${id}; last status ${last.status}`);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 25);
        });
        last = await getAdminJob(id);
    }

    return last;
}

describeDurable("admin durable job and audit storage", () => {
    before(async () => {
        await attachDatabase();
    });

    after(async () => {
        await detachDatabase();
    });

    test("persists audit records across a database reconnect", async () => {
        await clearAdminAuditEventsForTests();

        const recorded = await recordAdminAuditEvent({
            action: "user.delete",
            actorId: "operator",
            targetType: "user",
            targetId: "100",
            status: "accepted",
            severity: "danger",
            reason: "durable audit check",
            metadata: { idempotencyKey: "audit-key", reason: "durable audit check" },
            jobId: "job-100",
        });

        await simulateRestart();
        const listed = await listAdminAuditEvents({ limit: 10, offset: 0, q: "durable audit" });

        assert.equal(listed.pagination.total, 1);
        assert.equal(listed.items[0].id, recorded.id);
        assert.equal(listed.items[0].reason, "durable audit check");
        assert.deepEqual(listed.items[0].metadata, { idempotencyKey: "audit-key", reason: "durable audit check" });
    });

    test("persists job progress, failure, cancellation, idempotency, and restart recovery", async () => {
        await clearAdminJobsForTests();
        let recoveredRuns = 0;

        registerAdminJobRunner<{ id: string }, { recovered: boolean }>("test.recovered", (input) => async (context) => {
            recoveredRuns += 1;
            await context.setProgress({ current: 1, total: 1, label: input.id });
            return { recovered: true };
        });
        registerAdminJobRunner("test.fail", () => async () => {
            throw new Error("planned failure");
        });

        const first = await createAdminJob({
            type: "test.idempotent",
            input: { original: true },
            createdBy: "operator",
            idempotencyKey: "same-db-key",
            runner: async (context) => {
                await context.setProgress({ current: 1, total: 2, label: "created" });
                return { ok: true };
            },
        });
        const duplicate = await createAdminJob({
            type: "test.idempotent",
            input: { original: false },
            createdBy: "operator",
            idempotencyKey: "same-db-key",
            runner: async () => ({ ok: false }),
        });

        assert.equal(duplicate.id, first.id);
        assert.deepEqual(duplicate.input, { original: true });
        const completed = await waitForJob(first.id, (status) => status === "succeeded");
        assert.deepEqual(completed.progress, { current: 1, total: 2, label: "created" });

        const util = utilExports();
        const repo = dataSource!.getRepository(util.AdminJob);
        const createdAt = new Date();
        const staleClaimedAt = new Date(Date.now() - 10 * 60 * 1000);
        const cancelled = repo.create({
            type: "test.recovered",
            status: "queued",
            input: { id: "cancelled" },
            progress: { current: 0, total: null, label: null },
            errors: [],
            cancelRequested: true,
            idempotencyKey: null,
            createdBy: "operator",
            createdAt,
            updatedAt: createdAt,
        });
        const recovered = repo.create({
            type: "test.recovered",
            status: "running",
            input: { id: "recovered" },
            progress: { current: 0, total: null, label: null },
            errors: [],
            cancelRequested: false,
            idempotencyKey: null,
            createdBy: "operator",
            createdAt,
            updatedAt: createdAt,
            startedAt: createdAt,
            claimedAt: staleClaimedAt,
            claimedBy: "dead-worker",
        });
        const activeElsewhere = repo.create({
            type: "test.recovered",
            status: "running",
            input: { id: "active" },
            progress: { current: 0, total: null, label: null },
            errors: [],
            cancelRequested: false,
            idempotencyKey: null,
            createdBy: "operator",
            createdAt,
            updatedAt: createdAt,
            startedAt: createdAt,
            claimedAt: new Date(),
            claimedBy: "active-worker",
        });
        const failing = repo.create({
            type: "test.fail",
            status: "queued",
            input: {},
            progress: { current: 0, total: null, label: null },
            errors: [],
            cancelRequested: false,
            idempotencyKey: null,
            createdBy: "operator",
            createdAt,
            updatedAt: createdAt,
        });
        await repo.save([cancelled, recovered, activeElsewhere, failing]);

        await simulateRestart();
        await Promise.all([recoverAdminJobs(), recoverAdminJobs()]);

        assert.equal((await waitForJob(cancelled.id, (status) => status === "cancelled")).cancelRequested, true);
        assert.deepEqual((await waitForJob(recovered.id, (status) => status === "succeeded")).result, { recovered: true });
        assert.equal(recoveredRuns, 1);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });
        assert.equal((await getAdminJob(activeElsewhere.id)).status, "running");

        const failed = await waitForJob(failing.id, (status) => status === "failed");
        assert.equal(failed.errors[0], "planned failure");

        const cancellation = await requestAdminJobCancellation(recovered.id);
        assert.equal(cancellation.status, "succeeded");
    });
});

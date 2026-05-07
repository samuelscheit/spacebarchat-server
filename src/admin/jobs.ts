import { randomUUID } from "node:crypto";
import { HTTPError } from "lambert-server";
import { Page, paginated } from "./pagination";

type AdminJobEntity = import("../util/entities/AdminJob").AdminJob;

export type AdminJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AdminJobProgress {
    current: number;
    total: number | null;
    label: string | null;
}

export interface AdminJobSnapshot<TInput = unknown, TResult = unknown> {
    id: string;
    type: string;
    status: AdminJobStatus;
    input: TInput;
    result: TResult | null;
    progress: AdminJobProgress;
    errors: string[];
    cancelRequested: boolean;
    idempotencyKey: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

export interface AdminJobContext<TResult = unknown> {
    readonly job: AdminJobSnapshot<unknown, TResult>;
    setProgress(progress: Partial<AdminJobProgress>): Promise<void>;
    addError(error: unknown): Promise<void>;
    throwIfCancellationRequested(): Promise<void>;
}

export type AdminJobRunner<TResult = unknown> = (context: AdminJobContext<TResult>) => Promise<TResult>;
export type AdminJobRunnerFactory<TInput = unknown, TResult = unknown> = (input: TInput) => AdminJobRunner<TResult>;

interface MemoryAdminJobRecord<TInput = unknown, TResult = unknown> extends AdminJobSnapshot<TInput, TResult> {
    runner: AdminJobRunner<TResult>;
}

export interface CreateAdminJobOptions<TInput = unknown, TResult = unknown> {
    type: string;
    input: TInput;
    createdBy: string;
    idempotencyKey?: string | null;
    runner: AdminJobRunner<TResult>;
}

export interface AdminJobListOptions extends Page {
    q?: string;
}

// Jobs may carry different input/result types; snapshots keep the typed surface at call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryJobs = new Map<string, MemoryAdminJobRecord<any, any>>();
const memoryIdempotencyIndex = new Map<string, string>();
const runnerFactories = new Map<string, AdminJobRunnerFactory>();
const workerId = `${process.pid}:${randomUUID()}`;
const DEFAULT_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

function repository() {
    const util = require("@spacebar/util") as typeof import("@spacebar/util");
    return util.getDatabase()?.getRepository(util.AdminJob) ?? null;
}

function claimTimeoutMs() {
    const configured = Number.parseInt(process.env.ADMIN_JOB_CLAIM_TIMEOUT_MS ?? "", 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CLAIM_TIMEOUT_MS;
}

function staleClaimCutoff() {
    return new Date(Date.now() - claimTimeoutMs());
}

function now() {
    return new Date().toISOString();
}

function jsonClone<T>(value: T): T {
    if (value === undefined) return value;
    return JSON.parse(JSON.stringify(value)) as T;
}

function dateToIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function nullableDateToIso(date: Date | string | null | undefined): string | null {
    return date ? dateToIso(date) : null;
}

function normalizedProgress(progress: unknown): AdminJobProgress {
    const input = typeof progress === "object" && progress !== null && !Array.isArray(progress) ? (progress as Record<string, unknown>) : {};
    const current = typeof input.current === "number" && Number.isFinite(input.current) ? input.current : 0;
    const total = typeof input.total === "number" && Number.isFinite(input.total) ? input.total : null;
    const label = typeof input.label === "string" ? input.label : null;

    return { current, total, label };
}

function normalizedErrors(errors: unknown): string[] {
    return Array.isArray(errors) ? errors.map((error) => String(error)) : [];
}

function snapshotFromMemory<TInput, TResult>(job: MemoryAdminJobRecord<TInput, TResult>): AdminJobSnapshot<TInput, TResult> {
    return {
        id: job.id,
        type: job.type,
        status: job.status,
        input: jsonClone(job.input),
        result: job.result === null ? null : jsonClone(job.result),
        progress: { ...job.progress },
        errors: [...job.errors],
        cancelRequested: job.cancelRequested,
        idempotencyKey: job.idempotencyKey,
        createdBy: job.createdBy,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
    };
}

function snapshotFromEntity<TInput, TResult>(job: AdminJobEntity): AdminJobSnapshot<TInput, TResult> {
    return {
        id: job.id,
        type: job.type,
        status: job.status as AdminJobStatus,
        input: jsonClone(job.input as TInput),
        result: job.result === null ? null : jsonClone(job.result as TResult),
        progress: normalizedProgress(job.progress),
        errors: normalizedErrors(job.errors),
        cancelRequested: job.cancelRequested,
        idempotencyKey: job.idempotencyKey ?? null,
        createdBy: job.createdBy,
        createdAt: dateToIso(job.createdAt),
        updatedAt: dateToIso(job.updatedAt),
        startedAt: nullableDateToIso(job.startedAt),
        completedAt: nullableDateToIso(job.completedAt),
    };
}

function jobErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function idempotencyIndexKey(type: string, key: string) {
    return `${type}:${key}`;
}

function isUniqueConstraintError(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export function registerAdminJobRunner<TInput, TResult>(type: string, factory: AdminJobRunnerFactory<TInput, TResult>) {
    runnerFactories.set(type, factory as AdminJobRunnerFactory);
}

async function runMemoryJob<TInput, TResult>(job: MemoryAdminJobRecord<TInput, TResult>) {
    if (job.cancelRequested) {
        job.status = "cancelled";
        job.completedAt = now();
        job.updatedAt = job.completedAt;
        return;
    }

    job.status = "running";
    job.startedAt = now();
    job.updatedAt = job.startedAt;

    const context: AdminJobContext<TResult> = {
        job,
        async setProgress(progress) {
            job.progress = { ...job.progress, ...progress };
            job.updatedAt = now();
        },
        async addError(error) {
            job.errors.push(jobErrorMessage(error));
            job.updatedAt = now();
        },
        async throwIfCancellationRequested() {
            if (job.cancelRequested) throw new HTTPError("Job cancellation requested", 499);
        },
    };

    try {
        job.result = await job.runner(context);
        job.status = job.cancelRequested ? "cancelled" : "succeeded";
    } catch (error) {
        if (job.cancelRequested) {
            job.status = "cancelled";
        } else {
            job.status = "failed";
            await context.addError(error);
        }
    } finally {
        job.completedAt = now();
        job.updatedAt = job.completedAt;
    }
}

function createMemoryJob<TInput, TResult>(options: CreateAdminJobOptions<TInput, TResult>, idempotencyKey: string | null) {
    if (idempotencyKey) {
        const existingId = memoryIdempotencyIndex.get(idempotencyIndexKey(options.type, idempotencyKey));
        const existing = existingId ? memoryJobs.get(existingId) : undefined;
        if (existing) return snapshotFromMemory(existing as MemoryAdminJobRecord<TInput, TResult>);
    }

    const createdAt = now();
    const job: MemoryAdminJobRecord<TInput, TResult> = {
        id: randomUUID(),
        type: options.type,
        status: "queued",
        input: jsonClone(options.input),
        result: null,
        progress: {
            current: 0,
            total: null,
            label: null,
        },
        errors: [],
        cancelRequested: false,
        idempotencyKey,
        createdBy: options.createdBy,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        runner: options.runner,
    };

    memoryJobs.set(job.id, job);
    if (idempotencyKey) memoryIdempotencyIndex.set(idempotencyIndexKey(options.type, idempotencyKey), job.id);

    setImmediate(() => void runMemoryJob(job));

    return snapshotFromMemory(job);
}

async function markPersistedJobCancelled(job: AdminJobEntity) {
    const repo = repository();
    if (!repo) return;

    const completedAt = new Date();
    await repo.update(job.id, {
        status: "cancelled",
        completedAt,
        updatedAt: completedAt,
        claimedBy: null,
        claimedAt: null,
    });
}

async function claimPersistedJob(id: string) {
    const repo = repository();
    if (!repo) return null;

    const existing = await repo.findOne({ where: { id } });
    if (!existing) return null;
    if (existing.status === "queued" && existing.cancelRequested) {
        await markPersistedJobCancelled(existing);
        return null;
    }

    const startedAt = new Date();
    const result = await repo
        .createQueryBuilder()
        .update()
        .set({
            status: "running",
            startedAt,
            updatedAt: startedAt,
            claimedAt: startedAt,
            claimedBy: workerId,
        })
        .where("id = :id", { id })
        .andWhere("status = :status", { status: "queued" })
        .andWhere("cancel_requested = false")
        .execute();

    if (!result.affected) return null;
    return repo.findOne({ where: { id } });
}

async function failPersistedJob(id: string, current: AdminJobSnapshot, error: unknown) {
    const repo = repository();
    if (!repo) return;

    const completedAt = new Date();
    const errors = [...current.errors, jobErrorMessage(error)];
    current.errors = errors;
    current.status = "failed";
    current.completedAt = completedAt.toISOString();
    current.updatedAt = current.completedAt;

    await repo.update(id, {
        status: "failed",
        errors: jsonClone(errors),
        completedAt,
        updatedAt: completedAt,
    });
}

async function completePersistedJob<TResult>(id: string, current: AdminJobSnapshot<unknown, TResult>, result: TResult) {
    const repo = repository();
    if (!repo) return;

    const fresh = await repo.findOne({ where: { id } });
    const completedAt = new Date();
    const cancelled = fresh?.cancelRequested || current.cancelRequested;
    const status: AdminJobStatus = cancelled ? "cancelled" : "succeeded";
    const storedResult = result === undefined ? null : jsonClone(result);

    current.status = status;
    current.result = storedResult;
    current.cancelRequested = !!cancelled;
    current.completedAt = completedAt.toISOString();
    current.updatedAt = current.completedAt;

    await repo.update(id, {
        status,
        result: storedResult,
        cancelRequested: !!cancelled,
        completedAt,
        updatedAt: completedAt,
    } as Parameters<typeof repo.update>[1]);
}

async function createPersistedContext<TResult>(job: AdminJobEntity): Promise<AdminJobContext<TResult>> {
    const repo = repository();
    if (!repo) throw new Error("Admin job repository unavailable");

    const current = snapshotFromEntity<unknown, TResult>(job);

    return {
        job: current,
        async setProgress(progress) {
            current.progress = { ...current.progress, ...progress };
            const updatedAt = new Date();
            current.updatedAt = updatedAt.toISOString();
            await repo.update(job.id, {
                progress: jsonClone(current.progress),
                updatedAt,
                claimedAt: updatedAt,
                claimedBy: workerId,
            });
        },
        async addError(error) {
            current.errors = [...current.errors, jobErrorMessage(error)];
            const updatedAt = new Date();
            current.updatedAt = updatedAt.toISOString();
            await repo.update(job.id, {
                errors: jsonClone(current.errors),
                updatedAt,
                claimedAt: updatedAt,
                claimedBy: workerId,
            });
        },
        async throwIfCancellationRequested() {
            const fresh = await repo.findOne({ where: { id: job.id } });
            if (fresh?.cancelRequested) {
                current.cancelRequested = true;
                throw new HTTPError("Job cancellation requested", 499);
            }
        },
    };
}

async function runPersistedJob(id: string, fallbackRunner?: AdminJobRunner<unknown>) {
    const repo = repository();
    if (!repo) return;

    const job = await claimPersistedJob(id);
    if (!job) return;

    const runner = fallbackRunner ?? runnerFactories.get(job.type)?.(job.input);
    const context = await createPersistedContext(job);

    if (!runner) {
        await failPersistedJob(id, context.job, `No admin job runner registered for ${job.type}`);
        return;
    }

    try {
        const result = await runner(context);
        await completePersistedJob(id, context.job, result);
    } catch (error) {
        if (context.job.cancelRequested) {
            await markPersistedJobCancelled(job);
        } else {
            const fresh = await repo.findOne({ where: { id } });
            if (fresh?.cancelRequested) await markPersistedJobCancelled(fresh);
            else await failPersistedJob(id, context.job, error);
        }
    }
}

export async function recoverAdminJobs() {
    const repo = repository();
    if (!repo) return;

    const updatedAt = new Date();
    await repo
        .createQueryBuilder()
        .update()
        .set({
            status: "queued",
            claimedBy: null,
            claimedAt: null,
            updatedAt,
        })
        .where("status = :status", { status: "running" })
        .andWhere("(claimed_at IS NULL OR claimed_at < :staleClaimCutoff)", { staleClaimCutoff: staleClaimCutoff() })
        .execute();

    const queued = await repo.find({
        where: { status: "queued" },
        order: { createdAt: "ASC" },
    });

    for (const job of queued) setImmediate(() => void runPersistedJob(job.id));
}

export async function createAdminJob<TInput, TResult>(options: CreateAdminJobOptions<TInput, TResult>): Promise<AdminJobSnapshot<TInput, TResult>> {
    const idempotencyKey = options.idempotencyKey?.trim() || null;
    const repo = repository();
    if (!repo) return createMemoryJob(options, idempotencyKey);

    if (idempotencyKey) {
        const existing = await repo.findOne({ where: { type: options.type, idempotencyKey } });
        if (existing) return snapshotFromEntity(existing);
    }

    const createdAt = new Date();
    const job = repo.create({
        type: options.type,
        status: "queued",
        input: jsonClone(options.input),
        result: null,
        progress: {
            current: 0,
            total: null,
            label: null,
        },
        errors: [],
        cancelRequested: false,
        idempotencyKey,
        createdBy: options.createdBy,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        claimedBy: null,
        claimedAt: null,
    });

    try {
        await repo.save(job);
    } catch (error) {
        if (idempotencyKey && isUniqueConstraintError(error)) {
            const existing = await repo.findOne({ where: { type: options.type, idempotencyKey } });
            if (existing) return snapshotFromEntity(existing);
        }
        throw error;
    }

    setImmediate(() => void runPersistedJob(job.id, options.runner as AdminJobRunner<unknown>));

    return snapshotFromEntity(job);
}

export async function listAdminJobs(options: AdminJobListOptions) {
    const q = options.q?.toLowerCase();
    const repo = repository();

    if (repo) {
        const qb = repo.createQueryBuilder("job").orderBy("job.created_at", "DESC").take(options.limit).skip(options.offset);

        if (q) {
            qb.where(
                [
                    "LOWER(CAST(job.id AS varchar)) LIKE :q",
                    "LOWER(job.type) LIKE :q",
                    "LOWER(job.status) LIKE :q",
                    "LOWER(job.created_by) LIKE :q",
                    "LOWER(COALESCE(job.idempotency_key, '')) LIKE :q",
                ].join(" OR "),
                { q: `%${q}%` },
            );
        }

        const [items, total] = await qb.getManyAndCount();
        return paginated(
            items.map((job) => snapshotFromEntity(job)),
            total,
            options,
        );
    }

    const sorted = [...memoryJobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = q
        ? sorted.filter(
              (job) =>
                  job.id.toLowerCase().includes(q) ||
                  job.type.toLowerCase().includes(q) ||
                  job.status.includes(q) ||
                  job.createdBy.toLowerCase().includes(q) ||
                  job.idempotencyKey?.toLowerCase().includes(q),
          )
        : sorted;

    return paginated(
        filtered.slice(options.offset, options.offset + options.limit).map((job) => snapshotFromMemory(job)),
        filtered.length,
        options,
    );
}

export async function getAdminJob(id: string): Promise<AdminJobSnapshot> {
    const repo = repository();
    if (repo) {
        const job = await repo.findOne({ where: { id } });
        if (!job) throw new HTTPError("Job not found", 404);
        return snapshotFromEntity(job);
    }

    const job = memoryJobs.get(id);
    if (!job) throw new HTTPError("Job not found", 404);

    return snapshotFromMemory(job);
}

export async function requestAdminJobCancellation(id: string): Promise<AdminJobSnapshot> {
    const repo = repository();
    if (repo) {
        const job = await repo.findOne({ where: { id } });
        if (!job) throw new HTTPError("Job not found", 404);

        if (job.status === "queued" || job.status === "running") {
            const updatedAt = new Date();
            await repo.update(id, {
                cancelRequested: true,
                updatedAt,
            });
        }

        return getAdminJob(id);
    }

    const job = memoryJobs.get(id);
    if (!job) throw new HTTPError("Job not found", 404);

    if (job.status === "queued" || job.status === "running") {
        job.cancelRequested = true;
        job.updatedAt = now();
    }

    return snapshotFromMemory(job);
}

export async function clearAdminJobsForTests() {
    const repo = repository();
    if (repo) await repo.clear();
    memoryJobs.clear();
    memoryIdempotencyIndex.clear();
}

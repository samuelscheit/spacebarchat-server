import { randomUUID } from "node:crypto";
import { Page, paginated } from "./pagination";

type AdminAuditRecordEntity = import("../util/entities/AdminAuditRecord").AdminAuditRecord;

export type AdminAuditStatus = "accepted" | "succeeded" | "failed" | "cancel_requested";
export type AdminAuditSeverity = "info" | "warning" | "danger";

export interface AdminAuditRecord {
    id: string;
    action: string;
    actorId: string;
    targetType: string;
    targetId: string;
    status: AdminAuditStatus;
    severity: AdminAuditSeverity;
    metadata: Record<string, unknown>;
    reason: string | null;
    jobId: string | null;
    createdAt: string;
}

export interface CreateAdminAuditRecord {
    action: string;
    actorId: string;
    targetType: string;
    targetId: string;
    status: AdminAuditStatus;
    severity?: AdminAuditSeverity;
    metadata?: Record<string, unknown>;
    reason?: string | null;
    jobId?: string | null;
}

export interface AdminAuditListOptions extends Page {
    q?: string;
}

const MAX_MEMORY_AUDIT_RECORDS = 1000;
const memoryRecords: AdminAuditRecord[] = [];

function repository() {
    const util = require("@spacebar/util") as typeof import("@spacebar/util");
    return util.getDatabase()?.getRepository(util.AdminAuditRecord) ?? null;
}

function cloneMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!metadata) return {};
    return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function dateToIso(date: Date | string): string {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function reasonFrom(input: CreateAdminAuditRecord) {
    if (typeof input.reason === "string" && input.reason.trim()) return input.reason.trim();
    const metadataReason = input.metadata?.reason;
    return typeof metadataReason === "string" && metadataReason.trim() ? metadataReason.trim() : null;
}

function dtoFromEntity(entity: AdminAuditRecordEntity): AdminAuditRecord {
    return {
        id: entity.id,
        action: entity.action,
        actorId: entity.actorId,
        targetType: entity.targetType,
        targetId: entity.targetId,
        status: entity.status as AdminAuditStatus,
        severity: entity.severity as AdminAuditSeverity,
        metadata: cloneMetadata(entity.eventMetadata),
        reason: entity.reason ?? null,
        jobId: entity.jobId ?? null,
        createdAt: dateToIso(entity.createdAt),
    };
}

function dtoFromMemory(record: AdminAuditRecord): AdminAuditRecord {
    return { ...record, metadata: cloneMetadata(record.metadata) };
}

export async function recordAdminAuditEvent(input: CreateAdminAuditRecord): Promise<AdminAuditRecord> {
    const metadata = cloneMetadata(input.metadata);
    const record = {
        action: input.action,
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: input.status,
        severity: input.severity ?? "info",
        metadata,
        reason: reasonFrom(input),
        jobId: input.jobId ?? null,
    };

    const repo = repository();
    if (repo) {
        const entity = repo.create({
            action: record.action,
            actorId: record.actorId,
            targetType: record.targetType,
            targetId: record.targetId,
            status: record.status,
            severity: record.severity,
            eventMetadata: metadata,
            reason: record.reason,
            jobId: record.jobId,
        });
        await repo.save(entity);
        return dtoFromEntity(entity);
    }

    const memoryRecord: AdminAuditRecord = {
        id: randomUUID(),
        ...record,
        createdAt: new Date().toISOString(),
    };

    memoryRecords.unshift(memoryRecord);
    if (memoryRecords.length > MAX_MEMORY_AUDIT_RECORDS) memoryRecords.length = MAX_MEMORY_AUDIT_RECORDS;

    return dtoFromMemory(memoryRecord);
}

export async function listAdminAuditEvents(options: AdminAuditListOptions) {
    const q = options.q?.toLowerCase();
    const repo = repository();

    if (repo) {
        const qb = repo.createQueryBuilder("record").orderBy("record.created_at", "DESC").take(options.limit).skip(options.offset);

        if (q) {
            qb.where(
                [
                    "LOWER(record.action) LIKE :q",
                    "LOWER(record.actor_id) LIKE :q",
                    "LOWER(record.target_type) LIKE :q",
                    "LOWER(record.target_id) LIKE :q",
                    "LOWER(record.status) LIKE :q",
                    "LOWER(record.severity) LIKE :q",
                    "LOWER(COALESCE(record.reason, '')) LIKE :q",
                    "LOWER(COALESCE(record.job_id, '')) LIKE :q",
                ].join(" OR "),
                { q: `%${q}%` },
            );
        }

        const [items, total] = await qb.getManyAndCount();
        return paginated(
            items.map((record) => dtoFromEntity(record)),
            total,
            options,
        );
    }

    const filtered = q
        ? memoryRecords.filter(
              (record) =>
                  record.action.toLowerCase().includes(q) ||
                  record.actorId.toLowerCase().includes(q) ||
                  record.targetId.toLowerCase().includes(q) ||
                  record.targetType.toLowerCase().includes(q) ||
                  record.status.includes(q) ||
                  record.severity.includes(q) ||
                  (record.reason?.toLowerCase().includes(q) ?? false) ||
                  (record.jobId?.toLowerCase().includes(q) ?? false),
          )
        : memoryRecords;

    return paginated(
        filtered.slice(options.offset, options.offset + options.limit).map((record) => dtoFromMemory(record)),
        filtered.length,
        options,
    );
}

export async function clearAdminAuditEventsForTests() {
    const repo = repository();
    if (repo) await repo.clear();
    memoryRecords.length = 0;
}

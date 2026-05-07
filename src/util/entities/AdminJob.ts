import { Column, Entity, Index } from "typeorm";
import { BaseClass } from "./BaseClass";

export interface AdminJobProgressRecord {
    current: number;
    total: number | null;
    label: string | null;
}

@Entity({
    name: "admin_jobs",
})
@Index(["type", "idempotencyKey"], { unique: true, where: '"idempotency_key" IS NOT NULL' })
@Index(["status", "createdAt"])
export class AdminJob extends BaseClass {
    @Index()
    @Column()
    type: string;

    @Index()
    @Column()
    status: string;

    @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
    input: unknown = {};

    @Column({ type: "jsonb", nullable: true })
    result: unknown | null = null;

    @Column({ type: "jsonb", default: () => '\'{"current":0,"total":null,"label":null}\'::jsonb' })
    progress: AdminJobProgressRecord = { current: 0, total: null, label: null };

    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    errors: string[] = [];

    @Column({ name: "cancel_requested", default: false })
    cancelRequested: boolean = false;

    @Index()
    @Column({ name: "idempotency_key", type: "varchar", nullable: true })
    idempotencyKey: string | null = null;

    @Index()
    @Column({ name: "created_by" })
    createdBy: string;

    @Index()
    @Column({ name: "created_at", type: "timestamp", default: () => "now()" })
    createdAt: Date = new Date();

    @Column({ name: "updated_at", type: "timestamp", default: () => "now()" })
    updatedAt: Date = new Date();

    @Column({ name: "started_at", type: "timestamp", nullable: true })
    startedAt: Date | null = null;

    @Column({ name: "completed_at", type: "timestamp", nullable: true })
    completedAt: Date | null = null;

    @Column({ name: "claimed_by", type: "varchar", nullable: true })
    claimedBy: string | null = null;

    @Column({ name: "claimed_at", type: "timestamp", nullable: true })
    claimedAt: Date | null = null;
}

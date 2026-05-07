import { Column, Entity, Index } from "typeorm";
import { BaseClass } from "./BaseClass";

@Entity({
    name: "admin_audit_records",
})
export class AdminAuditRecord extends BaseClass {
    @Index()
    @Column()
    action: string;

    @Index()
    @Column({ name: "actor_id" })
    actorId: string;

    @Index()
    @Column({ name: "target_type" })
    targetType: string;

    @Index()
    @Column({ name: "target_id" })
    targetId: string;

    @Index()
    @Column()
    status: string;

    @Index()
    @Column()
    severity: string;

    @Column({ name: "metadata", type: "jsonb", default: () => "'{}'::jsonb" })
    eventMetadata: Record<string, unknown> = {};

    @Index()
    @Column({ name: "job_id", type: "varchar", nullable: true })
    jobId: string | null;

    @Column({ type: "varchar", nullable: true })
    reason: string | null;

    @Index()
    @Column({ name: "created_at", type: "timestamp", default: () => "now()" })
    createdAt: Date = new Date();
}

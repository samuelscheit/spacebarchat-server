import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminJobsAndAuditRecords1778062363001 implements MigrationInterface {
    name = "AdminJobsAndAuditRecords1778062363001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "admin_audit_records" ("id" int8 NOT NULL, "action" character varying NOT NULL, "actor_id" character varying NOT NULL, "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "status" character varying NOT NULL, "severity" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "job_id" character varying, "reason" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_admin_audit_records" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_action" ON "admin_audit_records" ("action")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_actor_id" ON "admin_audit_records" ("actor_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_target_type" ON "admin_audit_records" ("target_type")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_target_id" ON "admin_audit_records" ("target_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_status" ON "admin_audit_records" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_severity" ON "admin_audit_records" ("severity")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_job_id" ON "admin_audit_records" ("job_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_audit_records_created_at" ON "admin_audit_records" ("created_at")`);

        await queryRunner.query(
            `CREATE TABLE "admin_jobs" ("id" int8 NOT NULL, "type" character varying NOT NULL, "status" character varying NOT NULL, "input" jsonb NOT NULL DEFAULT '{}'::jsonb, "result" jsonb, "progress" jsonb NOT NULL DEFAULT '{"current":0,"total":null,"label":null}'::jsonb, "errors" jsonb NOT NULL DEFAULT '[]'::jsonb, "cancel_requested" boolean NOT NULL DEFAULT false, "idempotency_key" character varying, "created_by" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "started_at" TIMESTAMP, "completed_at" TIMESTAMP, "claimed_by" character varying, "claimed_at" TIMESTAMP, CONSTRAINT "PK_admin_jobs" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_type" ON "admin_jobs" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_status" ON "admin_jobs" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_idempotency_key" ON "admin_jobs" ("idempotency_key")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_created_by" ON "admin_jobs" ("created_by")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_created_at" ON "admin_jobs" ("created_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_jobs_status_created_at" ON "admin_jobs" ("status", "created_at")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_admin_jobs_type_idempotency_key" ON "admin_jobs" ("type", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_type_idempotency_key"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_status_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_created_by"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_idempotency_key"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_status"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_jobs_type"`);
        await queryRunner.query(`DROP TABLE "admin_jobs"`);

        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_created_at"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_job_id"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_severity"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_status"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_target_id"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_target_type"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_actor_id"`);
        await queryRunner.query(`DROP INDEX "IDX_admin_audit_records_action"`);
        await queryRunner.query(`DROP TABLE "admin_audit_records"`);
    }
}

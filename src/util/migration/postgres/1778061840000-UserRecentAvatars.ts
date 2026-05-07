import { MigrationInterface, QueryRunner } from "typeorm";

export class UserRecentAvatars1778061840000 implements MigrationInterface {
    name = "UserRecentAvatars1778061840000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "user_recent_avatars" ("id" int8 NOT NULL, "user_id" int8 NOT NULL, "storage_hash" character varying NOT NULL, "description" character varying(1024), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_user_recent_avatars_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_user_recent_avatars_user_latest" ON "user_recent_avatars" ("user_id", "id")`);
        await queryRunner.query(
            `ALTER TABLE "user_recent_avatars" ADD CONSTRAINT "FK_user_recent_avatars_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_recent_avatars" DROP CONSTRAINT "FK_user_recent_avatars_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_recent_avatars_user_latest"`);
        await queryRunner.query(`DROP TABLE "user_recent_avatars"`);
    }
}

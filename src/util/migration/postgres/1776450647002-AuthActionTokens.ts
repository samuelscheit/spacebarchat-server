import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthActionTokens1776450647002 implements MigrationInterface {
    name = "AuthActionTokens1776450647002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE auth_action_tokens (
            token_hash varchar NOT NULL,
            user_id int8 NOT NULL,
            purpose varchar NOT NULL,
            email varchar,
            created_at timestamp without time zone NOT NULL DEFAULT now(),
            expires_at timestamp without time zone NOT NULL,
            consumed_at timestamp without time zone,
            CONSTRAINT "PK_auth_action_tokens_token_hash" PRIMARY KEY (token_hash),
            CONSTRAINT auth_action_tokens_users_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`);
        await queryRunner.query(`CREATE INDEX "IDX_auth_action_tokens_user_purpose" ON auth_action_tokens (user_id, purpose);`);
        await queryRunner.query(`CREATE INDEX "IDX_auth_action_tokens_expires_at" ON auth_action_tokens (expires_at);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_auth_action_tokens_expires_at";`);
        await queryRunner.query(`DROP INDEX "IDX_auth_action_tokens_user_purpose";`);
        await queryRunner.query(`DROP TABLE auth_action_tokens;`);
    }
}

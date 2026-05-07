import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillMissingCreatorThreadMembers1778040000000 implements MigrationInterface {
    name = "BackfillMissingCreatorThreadMembers1778040000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO thread_members (id, member_idx, join_timestamp, muted, flags)
            SELECT
                channel.id,
                member."index",
                COALESCE(
                    timezone('UTC', NULLIF(channel.thread_metadata->>'create_timestamp', '')::timestamptz),
                    channel.created_at,
                    NOW()::timestamp
                ),
                false,
                0
            FROM channels channel
            INNER JOIN members member
                ON member.id = channel.owner_id
                AND member.guild_id = channel.guild_id
            WHERE channel.type IN (10, 11, 12)
            ON CONFLICT (id, member_idx) DO NOTHING;
        `);
    }

    public async down(_: QueryRunner): Promise<void> {}
}

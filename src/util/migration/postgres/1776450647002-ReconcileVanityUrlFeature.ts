import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileVanityUrlFeature1776450647002 implements MigrationInterface {
    name = "ReconcileVanityUrlFeature1776450647002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE guilds SET features = array_remove(features, 'VANITY_URL') WHERE features @> ARRAY['VANITY_URL']::varchar[];`);
        await queryRunner.query(`
			UPDATE guilds
			SET features = array_append(features, 'VANITY_URL')
			WHERE EXISTS (
				SELECT 1 FROM invites
				WHERE invites.guild_id = guilds.id
				AND invites.vanity_url = true
			)
			AND NOT features @> ARRAY['VANITY_URL']::varchar[];
		`);
    }

    public async down(): Promise<void> {
        return;
    }
}

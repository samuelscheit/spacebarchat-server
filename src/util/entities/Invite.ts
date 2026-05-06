/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Column, Entity, In, JoinColumn, ManyToOne, PrimaryColumn, RelationId, type EntityManager } from "typeorm";
import type { GuildUpdateEvent, InviteDeleteEvent } from "../interfaces";
import { emitEvent, getDatabase, getVanityUrlFeatureState } from "../util";
import { BaseClassWithoutId } from "./BaseClass";
import { Channel } from "./Channel";
import { Guild } from "./Guild";
import { Member } from "./Member";
import { User } from "./User";

export const PublicInviteRelation = ["inviter", "guild", "channel"];

@Entity({
    name: "invites",
})
export class Invite extends BaseClassWithoutId {
    @PrimaryColumn()
    code: string;

    @Column()
    temporary: boolean;

    @Column()
    uses: number;

    @Column()
    max_uses: number;

    @Column()
    max_age: number;

    @Column()
    created_at: Date;

    @Column({ nullable: true })
    expires_at?: Date;

    @Column({ nullable: true })
    @RelationId((invite: Invite) => invite.guild)
    guild_id: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, (guild) => guild.invites, {
        onDelete: "CASCADE",
    })
    guild: Guild;

    @Column({ nullable: true })
    @RelationId((invite: Invite) => invite.channel)
    channel_id: string;

    @JoinColumn({ name: "channel_id" })
    @ManyToOne(() => Channel, {
        onDelete: "CASCADE",
    })
    channel: Channel;

    @Column({ nullable: true })
    @RelationId((invite: Invite) => invite.inviter)
    inviter_id?: string;

    @JoinColumn({ name: "inviter_id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    inviter: User;

    @Column({ nullable: true })
    @RelationId((invite: Invite) => invite.target_user)
    target_user_id: string;

    @JoinColumn({ name: "target_user_id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    target_user?: string; // could be used for "User specific invites" https://github.com/spacebarchat/server/issues/326

    @Column({ nullable: true })
    target_user_type?: number;

    @Column({ nullable: true })
    vanity_url?: boolean;

    @Column()
    flags: number;

    isExpired() {
        if (this.max_age !== 0 && this.expires_at && this.expires_at < new Date()) return true;
        if (this.max_uses !== 0 && this.uses >= this.max_uses) return true;
        return false;
    }
    toPublicJSON() {
        return {
            ...this,
            inviter: this.inviter.toPublicUser(),
        };
    }

    static async syncGuildVanityUrlFeature(guild_id: string, entityManager: EntityManager) {
        const guild = await entityManager.findOne(Guild, { where: { id: guild_id } });
        if (!guild) return null;

        const vanityInviteCount = await entityManager.count(Invite, {
            where: { guild_id, vanity_url: true },
        });
        const state = getVanityUrlFeatureState(guild.features, vanityInviteCount > 0);
        if (!state.changed) return null;

        guild.features = state.features;
        await entityManager.save(guild);

        return guild;
    }

    static async syncGuildVanityUrlFeatures(guildIds: string[], entityManager: EntityManager) {
        const updatedGuilds: Guild[] = [];

        for (const guild_id of [...new Set(guildIds.filter(Boolean))]) {
            const updatedGuild = await Invite.syncGuildVanityUrlFeature(guild_id, entityManager);
            if (updatedGuild) updatedGuilds.push(updatedGuild);
        }

        return updatedGuilds;
    }

    static async deleteInvitesAndSyncVanityUrlFeatures(invites: Invite[], entityManager: EntityManager) {
        if (invites.length === 0) return [];

        const vanityGuildIds = invites.filter((invite) => invite.vanity_url && invite.guild_id).map((invite) => invite.guild_id);
        await entityManager.delete(Invite, { code: In(invites.map((invite) => invite.code)) });

        return Invite.syncGuildVanityUrlFeatures(vanityGuildIds, entityManager);
    }

    static async emitGuildUpdate(guild: Guild) {
        await emitEvent({
            event: "GUILD_UPDATE",
            data: guild.toGuildUpdateEventData(),
            guild_id: guild.id,
        } satisfies GuildUpdateEvent);
    }

    static async deleteWithVanityUrlFeatureSync(invites: Invite | Invite[], opts: { emitDeleteEvents?: boolean } = {}) {
        const inviteList = Array.isArray(invites) ? invites : [invites];
        if (inviteList.length === 0) return [];

        const database = getDatabase();
        if (!database) throw new Error("Tried to delete invites before the database was initialised");

        const updatedGuilds = await database.transaction((entityManager) => Invite.deleteInvitesAndSyncVanityUrlFeatures(inviteList, entityManager));

        await Promise.all([
            ...(opts.emitDeleteEvents
                ? inviteList.map((invite) =>
                      emitEvent({
                          event: "INVITE_DELETE",
                          guild_id: invite.guild_id,
                          data: {
                              channel_id: invite.channel_id,
                              guild_id: invite.guild_id,
                              code: invite.code,
                          },
                      } satisfies InviteDeleteEvent),
                  )
                : []),
            ...updatedGuilds.map((guild) => Invite.emitGuildUpdate(guild)),
        ]);

        return updatedGuilds;
    }

    static async joinGuild(user_id: string, code: string) {
        const invite = await Invite.findOneOrFail({ where: { code } });
        if (invite.isExpired()) {
            await Invite.deleteWithVanityUrlFeatureSync(invite);
            throw new Error("Invite is expired");
        }
        if (invite.uses++ >= invite.max_uses && invite.max_uses !== 0) await Invite.deleteWithVanityUrlFeatureSync(invite);
        else await invite.save();

        await Member.addToGuild(user_id, invite.guild_id);
        return invite;
    }
}

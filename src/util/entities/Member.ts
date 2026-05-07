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

import { HTTPError } from "lambert-server";
import { BeforeInsert, BeforeUpdate, Column, Entity, EntityManager, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, Not, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { Ban, Channel, PublicGuildRelations } from ".";
import { ReadyGuildDTO } from "../dtos";
import { type Event, GuildCreateEvent, GuildDeleteEvent, GuildMemberAddEvent, GuildMemberRemoveEvent, GuildMemberUpdateEvent, MessageCreateEvent } from "../interfaces";
import { Config, emitEvent, DiscordApiErrors } from "../util";
import { BaseClassWithoutId } from "./BaseClass";
import { Guild } from "./Guild";
import { Message } from "./Message";
import { Role } from "./Role";
import { User } from "./User";
import type { PublicMember, UserGuildSettings } from "../../schemas/api/users/Member";
import type { AvatarDecorationData, Collectibles, DisplayNameStyle } from "../../schemas/api/users/User";
import { memberToPublicMember } from "./MemberPublic";

export { MemberPrivateProjection } from "./MemberProjection";

export type DeferredMemberEvent = Omit<Event, "created_at">;

@Entity({
    name: "members",
})
@Index(["id", "guild_id"], { unique: true })
export class Member extends BaseClassWithoutId {
    @PrimaryGeneratedColumn()
    index: string;

    @Column()
    @RelationId((member: Member) => member.user)
    id: string;

    @JoinColumn({ name: "id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    user: User;

    @Column()
    @RelationId((member: Member) => member.guild)
    guild_id: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, {
        onDelete: "CASCADE",
    })
    guild: Guild;

    @Column({ nullable: true })
    nick?: string;

    @JoinTable({
        name: "member_roles",
        joinColumn: { name: "index", referencedColumnName: "index" },
        inverseJoinColumn: {
            name: "role_id",
            referencedColumnName: "id",
        },
    })
    @ManyToMany(() => Role, { cascade: true })
    roles: Role[];

    @Column()
    joined_at: Date;

    @Column({ type: "bigint", nullable: true })
    premium_since?: number;

    @Column()
    deaf: boolean;

    @Column()
    mute: boolean;

    @Column()
    pending: boolean;

    @Column({ type: "jsonb", select: false })
    settings: UserGuildSettings;

    @Column({ nullable: true })
    last_message_id?: string;

    /**
	@JoinColumn({ name: "id" })
	@ManyToOne(() => User, {
		onDelete: "DO NOTHING",
	// do not auto-kick force-joined members just because their joiners left the server
	}) **/
    @Column({ nullable: true })
    joined_by: string;

    @Column({ nullable: true })
    avatar?: string;

    @Column({ nullable: true })
    banner: string;

    @Column()
    bio: string;

    @Column({ nullable: true, type: "int4", array: true })
    theme_colors?: number[]; // TODO: Separate `User` and `UserProfile` models

    @Column({ nullable: true })
    pronouns?: string;

    @Column({ nullable: true, type: Date })
    communication_disabled_until: Date | null;

    // TODO: add this when we have proper read receipts
    // @Column({ type: "jsonb" })
    // read_state: ReadState;

    @Column({ type: "jsonb", nullable: true })
    avatar_decoration_data?: AvatarDecorationData;

    @Column({ type: "jsonb", nullable: true })
    display_name_styles?: DisplayNameStyle;

    @Column({ type: "jsonb", nullable: true })
    collectibles?: Collectibles;

    @Column({ type: "int", default: 0 })
    flags: number = 0;

    @BeforeUpdate()
    @BeforeInsert()
    validate() {
        if (this.nick) {
            this.nick = this.nick.split("\n").join("");
            this.nick = this.nick.split("\t").join("");
        }
        if (this.nick === "") this.nick = undefined;
        if (this.pronouns === "") this.pronouns = undefined;
    }

    static async IsInGuildOrFail(user_id: string, guild_id: string) {
        if (
            await Member.count({
                where: { id: user_id, guild_id },
            })
        )
            return;
        throw new HTTPError("You are not member of this guild", 403);
    }

    static async removeFromGuild(user_id: string, guild_id: string) {
        const guild = await Guild.findOneOrFail({
            select: { owner_id: true },
            where: { id: guild_id },
        });
        if (guild.owner_id === user_id) throw new Error("The owner cannot be removed from the guild");
        const member = await Member.findOneOrFail({
            where: { id: user_id, guild_id },
            relations: { user: true },
        });

        // use promise all to execute all promises at the same time -> save time
        return Promise.all([
            Member.delete({
                id: user_id,
                guild_id,
            }),
            Guild.decrement({ id: guild_id }, "member_count", 1),

            emitEvent({
                event: "GUILD_DELETE",
                data: {
                    id: guild_id,
                },
                user_id: user_id,
            } satisfies GuildDeleteEvent),
            emitEvent({
                event: "GUILD_MEMBER_REMOVE",
                data: { guild_id, user: member.user.toPublicUser() },
                guild_id,
            } satisfies GuildMemberRemoveEvent),
        ]);
    }

    static async addRole(user_id: string, guild_id: string, role_id: string) {
        const [member] = await Promise.all([
            Member.findOneOrFail({
                where: { id: user_id, guild_id },
                relations: { user: true, roles: true }, // we don't want to load  the role objects just the ids
                select: {
                    index: true,
                    roles: {
                        id: true,
                    },
                },
            }),
            Role.findOneOrFail({
                where: { id: role_id, guild_id },
                select: { id: true },
            }),
        ]);
        member.roles.push(Role.create({ id: role_id }));

        await Promise.all([
            member.save(),
            emitEvent({
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id,
                    user: member.user,
                    roles: member.roles.map((x) => x.id),
                },
                guild_id,
            } satisfies GuildMemberUpdateEvent),
        ]);
    }

    static async removeRole(user_id: string, guild_id: string, role_id: string) {
        const [member] = await Promise.all([
            Member.findOneOrFail({
                where: { id: user_id, guild_id },
                relations: { user: true, roles: true }, // we don't want to load  the role objects just the ids
                select: {
                    index: true,
                    roles: {
                        id: true,
                    },
                },
            }),
            Role.findOneOrFail({ where: { id: role_id, guild_id } }),
        ]);
        member.roles = member.roles.filter((x) => x.id !== role_id);

        await Promise.all([
            member.save(),
            emitEvent({
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id,
                    user: member.user,
                    roles: member.roles.map((x) => x.id),
                },
                guild_id,
            } satisfies GuildMemberUpdateEvent),
        ]);
    }

    static async changeNickname(user_id: string, guild_id: string, nickname: string) {
        const member = await Member.findOneOrFail({
            where: {
                id: user_id,
                guild_id,
            },
            relations: { user: true, roles: true },
        });

        // @ts-expect-error Member nickname is nullable
        member.nick = nickname || null;

        await Promise.all([
            member.save(),

            emitEvent({
                event: "GUILD_MEMBER_UPDATE",
                data: {
                    guild_id,
                    user: member.user,
                    nick: nickname || undefined,
                    roles: member.roles.map((x) => x.id),
                },
                guild_id,
            } satisfies GuildMemberUpdateEvent),
        ]);
    }

    static async addToGuild(user_id: string, guild_id: string, options?: { manager?: EntityManager; deferredEvents?: DeferredMemberEvent[] }) {
        const channelRepository = options?.manager?.getRepository(Channel) ?? Channel.getRepository();
        const guildRepository = options?.manager?.getRepository(Guild) ?? Guild.getRepository();
        const memberRepository = options?.manager?.getRepository(Member) ?? Member.getRepository();
        const messageRepository = options?.manager?.getRepository(Message) ?? Message.getRepository();
        const dispatchEvent = async (payload: DeferredMemberEvent) => {
            if (options?.deferredEvents) {
                options.deferredEvents.push(payload);
                return;
            }

            await emitEvent(payload);
        };

        const user = await User.getPublicUser(user_id, options?.manager);
        const isBanned = await (options?.manager?.getRepository(Ban) ?? Ban.getRepository()).count({ where: { guild_id, user_id } });
        if (isBanned) {
            throw DiscordApiErrors.USER_BANNED;
        }
        const { maxGuilds } = Config.get().limits.user;
        const guild_count = await memberRepository.count({ where: { id: user_id } });
        if (guild_count >= maxGuilds) {
            throw new HTTPError(`You are at the ${maxGuilds} server limit.`, 403);
        }

        const guild = await guildRepository.findOneOrFail({
            where: {
                id: guild_id,
            },
            relations: PublicGuildRelations,
            relationLoadStrategy: "query",
        });

        for await (const channel of guild.channels) {
            channel.position = await Channel.calculatePosition(channel.id, guild_id, guild);
        }

        const memberCount = await memberRepository.count({ where: { guild_id } });

        const memberPreview = (
            await memberRepository.find({
                where: {
                    guild_id,
                    user: {
                        sessions: {
                            status: Not("invisible" as const), // lol typescript?
                        },
                    },
                },
                relations: { user: true, roles: true },
                take: 10,
            })
        ).map((member) => member.toPublicMember());

        if (
            await memberRepository.count({
                where: { id: user.id, guild_id },
            })
        )
            throw new HTTPError("You are already a member of this guild", 400);

        const member = {
            id: user_id,
            guild_id,
            nick: undefined,
            roles: [guild_id], // @everyone role
            joined_at: new Date(),
            deaf: false,
            mute: false,
            pending: false,
            bio: "",
        };

        const newMember = memberRepository.create({
            ...member,
            roles: [Role.create({ id: guild_id })],
            // read_state: {},
            settings: {
                guild_id: null,
                mute_config: null,
                mute_scheduled_events: false,
                flags: 0,
                hide_muted_channels: false,
                notify_highlights: 0,
                channel_overrides: {},
                message_notifications: guild.default_message_notifications,
                mobile_push: true,
                muted: false,
                suppress_everyone: false,
                suppress_roles: false,
                version: 0,
            },
            // Member.save is needed because else the roles relations wouldn't be updated
        });

        await Promise.all([
            memberRepository.save(newMember),
            guildRepository.increment({ id: guild_id }, "member_count", 1),
            dispatchEvent({
                event: "GUILD_MEMBER_ADD",
                data: {
                    ...newMember.toPublicMember(),
                    user: user,
                    guild_id,
                },
                guild_id,
                origin: "util/entities/Member.ts:377/addToGuild(user_id, guild_id)",
            } satisfies GuildMemberAddEvent),
            dispatchEvent({
                event: "GUILD_CREATE",
                data: {
                    ...new ReadyGuildDTO(guild).toJSON(),
                    members: [...memberPreview, { ...newMember.toPublicMember(), user }],
                    member_count: memberCount + 1,
                    guild_hashes: {},
                    guild_scheduled_events: [],
                    joined_at: newMember.joined_at,
                    presences: [],
                    stage_instances: [],
                    threads: [],
                    embedded_activities: [],
                    voice_states: guild.voice_states.map((x) => x.toPublicVoiceState()),
                },
                user_id,
            } satisfies GuildCreateEvent),
        ]);

        if (guild.system_channel_id) {
            const channel = await channelRepository.findOneOrFail({
                where: { id: guild.system_channel_id },
            });
            // Send a welcome message
            const message = messageRepository.create({
                type: 7,
                guild_id: guild.id,
                channel_id: guild.system_channel_id,
                author: user,
                timestamp: new Date(),
                reactions: [],
                attachments: [],
                embeds: [],
                sticker_items: [],
                edited_timestamp: undefined,
                mentions: [],
                mention_channels: [],
                mention_roles: [],
                mention_everyone: false,
            });

            channel.last_message_id = message.id;

            await messageRepository.save(message);
            const publicMsg = message.toJSON();
            await Promise.all([
                dispatchEvent({
                    event: "MESSAGE_CREATE",
                    channel_id: message.channel_id,
                    data: publicMsg,
                } satisfies MessageCreateEvent),
                channelRepository.save(channel),
            ]);
        }
    }

    toPublicMember(): PublicMember {
        return memberToPublicMember(this);
    }
}

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
import { Column, Entity, In, JoinColumn, ManyToOne, OneToMany, RelationId } from "typeorm";
import { DmChannelDTO, getCreateDMChannelResponse, saveGroupDMOwnerAfterRecipientRemoval } from "../dtos";
import { ChannelCreateEvent, ChannelRecipientRemoveEvent, ThreadCreateEvent, ThreadMembersUpdateEvent } from "../interfaces";
import {
    Snowflake,
    emitEvent,
    getPermission,
    trimSpecial,
    Permissions,
    Config,
    DiscordApiErrors,
    getDatabase,
    handleFile,
    normalizeChannelName,
    normalizeThreadName,
    assertChannelNamePresent,
    canCreateServerDm,
    shouldCheckServerDmPrivacy,
} from "../util";
import { BaseClass } from "./BaseClass";
import { Guild } from "./Guild";
import { Invite } from "./Invite";
import { Message } from "./Message";
import { Tag } from "./Tag";
import { Recipient } from "./Recipient";
import { User } from "./User";
import { VoiceState } from "./VoiceState";
import { Webhook } from "./Webhook";
import { Member } from "./Member";
import { ChannelPermissionOverwrite, ChannelType, PublicChannel, PublicUserProjection, RelationshipType, ThreadMetadata } from "@spacebar/schemas";
import { ReadStateType } from "../../schemas/uncategorised/MessageAcknowledgeSchema";
import { OrmUtils } from "../imports";
import { ThreadMember } from "./ThreadMember";
import { ReadState } from "./ReadState";
import { getGuildChannelOrdering } from "../util/GuildChannelOrdering";
import { Relationship } from "./Relationship";

@Entity({
    name: "channels",
})
export class Channel extends BaseClass {
    @Column()
    created_at: Date;

    @Column({ nullable: true })
    name?: string;

    @Column({ type: "text", nullable: true })
    icon?: string | null;

    @Column({ type: "int" })
    type: ChannelType;

    @OneToMany(() => Recipient, (recipient: Recipient) => recipient.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    recipients?: Recipient[];

    @OneToMany(() => ThreadMember, (member: ThreadMember) => member.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    thread_members?: ThreadMember[];

    @Column({ nullable: true })
    last_message_id?: string;

    @Column({ nullable: true })
    @RelationId((channel: Channel) => channel.guild)
    guild_id?: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, (guild) => guild.channels, {
        onDelete: "CASCADE",
        nullable: true,
    })
    guild?: Guild;

    @Column({ nullable: true })
    @RelationId((channel: Channel) => channel.parent)
    parent_id: string | null;

    @JoinColumn({ name: "parent_id" })
    @ManyToOne(() => Channel)
    parent?: Channel;

    // for group DMs and owned custom channel types
    @Column({ nullable: true })
    @RelationId((channel: Channel) => channel.owner)
    owner_id?: string;

    @JoinColumn({ name: "owner_id" })
    @ManyToOne(() => User)
    owner: User;

    @Column({ nullable: true, type: "timestamp with time zone" })
    last_pin_timestamp?: Date | null; // ISO8601

    @Column({ nullable: true })
    default_auto_archive_duration?: number;

    @Column({ type: "jsonb", nullable: true })
    permission_overwrites?: ChannelPermissionOverwrite[];

    @Column({ nullable: true })
    video_quality_mode?: number;

    @Column({ nullable: true })
    bitrate?: number;

    @Column({ nullable: true })
    user_limit?: number;

    @Column()
    nsfw: boolean = false;

    @Column({ nullable: true })
    rate_limit_per_user?: number;

    @Column({ nullable: true })
    topic?: string;

    @OneToMany(() => Invite, (invite: Invite) => invite.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    invites?: Invite[];

    @Column({ nullable: true })
    retention_policy_id?: string;

    @OneToMany(() => Message, (message: Message) => message.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    messages?: Message[];

    @OneToMany(() => VoiceState, (voice_state: VoiceState) => voice_state.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    voice_states?: VoiceState[];

    @OneToMany(() => Webhook, (webhook: Webhook) => webhook.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    webhooks?: Webhook[];

    @Column()
    flags: number = 0;

    @Column({ nullable: true })
    default_thread_rate_limit_per_user?: number = 0;

    @Column({ type: "jsonb", nullable: true })
    thread_metadata?: ThreadMetadata;

    @Column({ nullable: true })
    member_count?: number;

    @Column({ nullable: true })
    message_count?: number;

    @Column({ nullable: true })
    total_message_sent?: number;

    @JoinColumn({ name: "available_tags_ids" })
    @OneToMany(() => Tag, (tag: Tag) => tag.channel, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    available_tags?: Tag[];

    @Column("text", { array: true, nullable: true })
    applied_tags?: string[];

    @Column("text", { nullable: true })
    status?: string | null;

    /** Must be calculated Channel.calculatePosition */
    position: number;

    // TODO: DM channel
    static async createChannel(
        channel: Partial<Channel>,
        user_id: string = "0",
        opts?: {
            keepId?: boolean;
            skipExistsCheck?: boolean;
            skipPermissionCheck?: boolean;
            skipEventEmit?: boolean;
            skipNameChecks?: boolean;
            skipOrdering?: boolean;
        },
    ): Promise<Channel> {
        if (!opts?.skipPermissionCheck) {
            // Always check if user has permission first
            const permissions = await getPermission(user_id, channel.guild_id);
            permissions.hasThrow("MANAGE_CHANNELS");
        }

        const guild = await Guild.findOneOrFail({
            where: { id: channel.guild_id },
            select: {
                features: !opts?.skipNameChecks,
                channel_ordering: true,
                id: true,
            },
        });

        if (!opts?.skipNameChecks) {
            channel.name = normalizeChannelName(channel.name, channel.type, guild.features);
            assertChannelNamePresent(channel.name, guild.features);
        }

        switch (channel.type) {
            // TODO: should threads even be routed through this function instead of createThreadChannel?
            case ChannelType.GUILD_PUBLIC_THREAD:
            case ChannelType.GUILD_PRIVATE_THREAD:
            case ChannelType.GUILD_NEWS_THREAD:
            case ChannelType.GUILD_TEXT:
            case ChannelType.GUILD_FORUM:
            case ChannelType.GUILD_MEDIA:
            case ChannelType.GUILD_NEWS:
            case ChannelType.GUILD_VOICE:
                if (channel.parent_id && !opts?.skipExistsCheck) {
                    const exists = await Channel.findOneOrFail({
                        where: { id: channel.parent_id },
                    });
                    if (!exists) throw new HTTPError("Parent id channel doesn't exist", 400);
                    if (exists.guild_id !== channel.guild_id) throw new HTTPError("The category channel needs to be in the guild");
                }
                break;
            case ChannelType.GUILD_CATEGORY:
            case ChannelType.UNHANDLED:
                break;
            case ChannelType.DM:
            case ChannelType.GROUP_DM:
                throw new HTTPError("You can't create a dm channel in a guild");
            case ChannelType.GUILD_STORE:
            default:
                throw new HTTPError("Not yet supported");
        }

        if (!channel.permission_overwrites) channel.permission_overwrites = [];
        // TODO: eagerly auto generate position of all guild channels

        const position = (channel.type === ChannelType.UNHANDLED ? 0 : channel.position) || 0;
        const id = opts?.keepId && channel.id ? channel.id : Snowflake.generate();

        if (typeof channel.icon === "string" && channel.icon.startsWith("data:")) {
            channel.icon = await handleFile(`/channel-icons/${id}`, channel.icon);
        }

        channel = {
            ...channel,
            id,
            created_at: new Date(),
            position,
            // from #876 (threads): shouldnt these be undefined?
            // message_count: 0,
            // member_count: 0,
            // total_message_sent: 0,
        };

        // TODO: figure out why the generic is required here
        const ret = Channel.create<Channel>(channel);

        await Promise.all([
            ret.save(),
            !opts?.skipEventEmit
                ? emitEvent({
                      event: "CHANNEL_CREATE",
                      data: ret.toJSON(),
                      guild_id: channel.guild_id,
                  } satisfies ChannelCreateEvent)
                : Promise.resolve(),
            opts?.skipOrdering ? Promise.resolve() : Guild.insertChannelInOrder(guild.id, ret.id, position, guild),
        ]);

        return ret;
    }
    threadOnly() {
        return this.type === ChannelType.GUILD_FORUM || this.type === ChannelType.GUILD_MEDIA;
    }

    static async createThreadChannel(
        channel: Partial<Channel>,
        metadata: Partial<ThreadMetadata>,
        user_id: string = "0",
        opts?: {
            keepId?: boolean;
            skipExistsCheck?: boolean;
            skipParentExistsCheck?: boolean;
            skipPermissionCheck?: boolean;
            skipEventEmit?: boolean;
            skipNameChecks?: boolean;
        },
    ): Promise<Channel> {
        const threadId = opts?.keepId && channel.id ? channel.id : Snowflake.generate();

        channel = {
            // set the default type to private
            type: ChannelType.GUILD_PRIVATE_THREAD,
            ...channel,
            id: threadId,
            created_at: new Date(),
            position: 0, // TODO:
            message_count: 0,
            member_count: 1,
            total_message_sent: 0,
        };

        const exists = await Channel.findOne({
            where: {
                id: channel.id,
            },
        });

        const guild = await Guild.findOneOrFail({ where: { id: channel.guild_id } });

        if (!opts?.skipExistsCheck && !guild.features.includes("ALLOW_EXISTING_THREAD_FOR_MESSAGE") && exists) throw DiscordApiErrors.THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE;

        if (!channel.parent_id) throw new HTTPError("Parent id not set", 400);
        const parent = await Channel.findOneOrFail({ where: { id: channel.parent_id } });

        if (!opts?.skipPermissionCheck) {
            // Always check if user has permission first
            const permissions = await getPermission(user_id, parent.guild_id);
            permissions.hasThrow(channel.type === ChannelType.GUILD_PRIVATE_THREAD ? "CREATE_PRIVATE_THREADS" : "CREATE_PUBLIC_THREADS");
        }

        channel = {
            ...channel,
            permission_overwrites: parent.permission_overwrites,
            nsfw: parent.nsfw,
            owner_id: user_id,
            guild_id: parent.guild_id,
            thread_metadata: {
                create_timestamp: new Date().toISOString(),
                archive_timestamp: new Date().toISOString(),
                archived: false,
                auto_archive_duration: 0,
                invitable: channel.type === ChannelType.GUILD_NEWS_THREAD || channel.type === ChannelType.GUILD_PUBLIC_THREAD ? Config.get().guild.publicThreadsInvitable : false,
                locked: false,
                ...metadata,
            },
        };

        if (!opts?.skipParentExistsCheck) {
            if (!parent) throw new HTTPError("Parent channel doesn't exist", 400);
            if (parent.guild_id !== channel.guild_id) throw new HTTPError("The category channel needs to be in the guild");
        }

        if (!opts?.skipNameChecks) {
            const guild = await Guild.findOneOrFail({ where: { id: channel.guild_id } });
            channel.name = normalizeThreadName(channel.name, guild.features);
            assertChannelNamePresent(channel.name, guild.features);
        }

        const thread = await OrmUtils.mergeDeep(new Channel(), channel).save();

        const threadMember = await ThreadMember.createForUser(user_id, thread);

        if (!opts?.skipEventEmit) {
            await Promise.all([
                emitEvent({
                    event: "THREAD_CREATE",
                    data: {
                        ...thread,
                        newly_created: true,
                    },
                    guild_id: channel.guild_id,
                } satisfies ThreadCreateEvent),
                emitEvent({
                    event: "THREAD_MEMBERS_UPDATE",
                    data: {
                        guild_id: channel.guild_id!, // TODO: is this the right fix?
                        id: thread.id,
                        member_count: channel.member_count ?? 0, //TODO: is this the right fix?
                        added_members: [{ user_id, ...threadMember.toJSON() }],
                        removed_member_ids: [],
                    },
                    guild_id: channel.guild_id,
                } satisfies ThreadMembersUpdateEvent),
            ]);
        }

        return thread;
    }

    static async createDMChannel(recipients: string[], creator_user_id: string, name?: string) {
        recipients = [...new Set(recipients)].filter((x) => x !== creator_user_id);
        // TODO: check config for max number of recipients
        /** if you want to disallow note to self channels, uncomment the conditional below

		const otherRecipientsUsers = await User.find({ where: recipients.map((x) => ({ id: x })) });
		if (otherRecipientsUsers.length !== recipients.length) {
			throw new HTTPError("Recipient/s not found");
		}
		**/

        const type = recipients.length > 1 ? ChannelType.GROUP_DM : ChannelType.DM;

        let channel = null;
        let needsTx = true;
        let creatorRecipient: Recipient | null = null;

        const channelRecipients = [...recipients, creator_user_id];

        const userRecipients = await Recipient.find({
            where: { user_id: creator_user_id },
            relations: { channel: { recipients: true } },
        });

        for (const ur of userRecipients) {
            if (!ur.channel.recipients) continue;
            const re = ur.channel.recipients.map((r) => r.user_id);
            if (re.length === channelRecipients.length) {
                if (channelRecipients.every((_) => re.includes(_))) {
                    if (channel == null) {
                        channel = ur.channel;
                        creatorRecipient = ur;
                        if (!ur.closed) needsTx = false;
                    }
                }
            }
        }

        if (
            type === ChannelType.DM &&
            shouldCheckServerDmPrivacy({
                recipientCount: recipients.length,
                existingCreatorRecipientClosed: creatorRecipient?.closed,
            })
        ) {
            await Channel.checkServerDmPrivacy(creator_user_id, recipients[0]);
        }

        if (channel == null) {
            name = trimSpecial(name);

            channel = await Channel.create({
                name,
                type,
                owner_id: type === ChannelType.GROUP_DM ? creator_user_id : undefined,
                created_at: new Date(),
                last_message_id: undefined,
                recipients: channelRecipients.map((x) =>
                    Recipient.create({
                        user_id: x,
                        closed: !(type === ChannelType.GROUP_DM || x === creator_user_id),
                    }),
                ),
                nsfw: false,
            }).save();
        }

        if (creatorRecipient?.closed) {
            await creatorRecipient.assign({ closed: false }).save();
        }

        const channel_dto = await DmChannelDTO.from(channel);

        if (!needsTx) {
            /*ignored*/
        } else if (type === ChannelType.GROUP_DM && channel.recipients) {
            for (const recipient of channel.recipients) {
                await emitEvent({
                    event: "CHANNEL_CREATE",
                    data: channel_dto.forRecipient(recipient.user_id),
                    user_id: recipient.user_id,
                });
            }
        } else {
            await emitEvent({
                event: "CHANNEL_CREATE",
                data: channel_dto.forRecipient(creator_user_id),
                user_id: creator_user_id,
            });
        }

        return getCreateDMChannelResponse(channel_dto, creator_user_id);
    }

    static async checkServerDmReopenPrivacy(channel: Channel, creatorUserId: string) {
        if (channel.type !== ChannelType.DM) return;

        const recipients = channel.recipients ?? (await Recipient.find({ where: { channel_id: channel.id } }));
        const creatorRecipient = recipients.find((recipient) => recipient.user_id === creatorUserId);
        const recipient = recipients.find((recipient) => recipient.user_id !== creatorUserId);

        if (
            creatorRecipient &&
            recipient &&
            shouldCheckServerDmPrivacy({
                recipientCount: recipients.length - 1,
                existingCreatorRecipientClosed: creatorRecipient.closed,
            })
        ) {
            await Channel.checkServerDmPrivacy(creatorUserId, recipient.user_id);
        }
    }

    static async checkServerDmPrivacy(creatorUserId: string, recipientUserId: string) {
        const [relationships, recipient, members] = await Promise.all([
            Relationship.find({
                where: [
                    { from_id: recipientUserId, to_id: creatorUserId },
                    { from_id: creatorUserId, to_id: recipientUserId },
                ],
            }),
            User.findOne({
                where: { id: recipientUserId },
                relations: { settings: true },
            }),
            Member.find({
                where: { id: In([creatorUserId, recipientUserId]) },
                select: { id: true, guild_id: true },
            }),
        ]);

        if (!recipient) throw new HTTPError("Recipient/s not found");

        const isFriend = relationships.some((relationship) => relationship.type === RelationshipType.friends);
        const isBlocked = relationships.some((relationship) => relationship.type === RelationshipType.blocked);
        const creatorGuildIds = new Set(members.filter((member) => member.id === creatorUserId).map((member) => member.guild_id));
        const sharedGuildIds = members.filter((member) => member.id === recipientUserId && creatorGuildIds.has(member.guild_id)).map((member) => member.guild_id);

        if (
            !canCreateServerDm({
                isBlocked,
                isFriend,
                recipientSettings: recipient?.settings,
                sharedGuildIds,
            })
        ) {
            throw DiscordApiErrors.CANNOT_MESSAGE_USER;
        }
    }

    static async removeRecipientFromChannel(channel: Channel, user_id: string) {
        await Recipient.delete({ channel_id: channel.id, user_id: user_id });
        channel.recipients = channel.recipients?.filter((r) => r.user_id !== user_id);

        if (channel.recipients?.length === 0) {
            await Channel.deleteChannel(channel);
            await emitEvent({
                event: "CHANNEL_DELETE",
                data: await DmChannelDTO.from(channel, [user_id]),
                user_id: user_id,
            });
            return;
        }

        const ownerChanged = await saveGroupDMOwnerAfterRecipientRemoval(channel, channel.recipients?.map((recipient) => recipient.user_id) ?? []);

        await emitEvent({
            event: "CHANNEL_DELETE",
            data: await DmChannelDTO.from(channel, [user_id]),
            user_id: user_id,
        });

        if (ownerChanged) {
            await emitEvent({
                event: "CHANNEL_UPDATE",
                data: await DmChannelDTO.from(channel, [user_id]),
                channel_id: channel.id,
            });
        }

        await emitEvent({
            event: "CHANNEL_RECIPIENT_REMOVE",
            data: {
                channel_id: channel.id,
                user: await User.findOneOrFail({
                    where: { id: user_id },
                    select: PublicUserProjection,
                }),
            },
            channel_id: channel.id,
        } satisfies ChannelRecipientRemoveEvent);
    }

    static async deleteChannel(channel: Channel) {
        // TODO Delete attachments from the CDN for messages in the channel
        const database = getDatabase();
        if (!database) throw new Error("Tried to delete a channel before the database was initialised");

        const updatedGuilds = await database.transaction(async (entityManager) => {
            await entityManager.delete(ReadState, { channel_id: channel.id, read_state_type: ReadStateType.CHANNEL });
            await entityManager.delete(Channel, { id: channel.id });

            if (channel.guild_id) {
                const guild = await entityManager.findOneOrFail(Guild, {
                    where: { id: channel.guild_id },
                    select: { channel_ordering: true },
                });

                const updatedOrdering = getGuildChannelOrdering(guild).filter((id) => id != channel.id);
                await entityManager.update(Guild, { id: channel.guild_id }, { channel_ordering: updatedOrdering });

                const updatedGuild = await Invite.syncGuildVanityUrlFeature(channel.guild_id, entityManager);
                return updatedGuild ? [updatedGuild] : [];
            }

            return [];
        });

        await Promise.all(updatedGuilds.map((guild) => Invite.emitGuildUpdate(guild)));
    }

    static async calculatePosition(channel_id: string, guild_id: string, guild?: Guild) {
        if (!guild)
            guild = await Guild.findOneOrFail({
                where: { id: guild_id },
                select: { channel_ordering: true },
            });

        return getGuildChannelOrdering(guild).findIndex((id) => channel_id == id);
    }

    static async getOrderedChannels(guild_id: string, guild?: Guild) {
        if (!guild)
            guild = await Guild.findOneOrFail({
                where: { id: guild_id },
                select: { channel_ordering: true },
            });

        const channelOrdering = getGuildChannelOrdering(guild);
        const channels = await Promise.all(channelOrdering.map((id) => Channel.findOne({ where: { id } })));

        return channels
            .filter((channel) => channel !== null)
            .reduce((r, v) => {
                v = v as Channel;

                v.position = channelOrdering.indexOf(v.id);
                r[v.position] = v;
                return r;
            }, [] as Array<Channel>);
    }

    isDm() {
        return this.type === ChannelType.DM || this.type === ChannelType.GROUP_DM;
    }

    isThread() {
        return this.type === ChannelType.GUILD_NEWS_THREAD || this.type === ChannelType.GUILD_PUBLIC_THREAD || this.type === ChannelType.GUILD_PRIVATE_THREAD;
    }
    isForum() {
        return this.type === ChannelType.GUILD_FORUM || this.type === ChannelType.GUILD_MEDIA;
    }

    isPrivateThread() {
        return this.type === ChannelType.GUILD_PRIVATE_THREAD;
    }

    isPublicThread() {
        return this.type === ChannelType.GUILD_NEWS_THREAD || this.type === ChannelType.GUILD_PUBLIC_THREAD;
    }

    // Does the channel support sending messages ( eg categories do not )
    isWritable() {
        const disallowedChannelTypes = [ChannelType.GUILD_CATEGORY, ChannelType.GUILD_STAGE_VOICE];
        return disallowedChannelTypes.indexOf(this.type) == -1;
    }

    async getUserPermissions(opts: { user_id?: string; user?: User; member?: Member; guild?: Guild }): Promise<Permissions> {
        if (this.isDm()) return this.owner_id == (opts.user_id ?? opts.user?.id) ? Permissions.ALL : Permissions.DEFAULT_DM_PERMISSIONS;
        let guild = opts.guild;
        if (!guild) {
            if (this.guild) guild = this.guild;
            else if (this.guild_id) guild = await Guild.findOneOrFail({ where: { id: this.guild_id } });
            else {
                console.error("Channel.getUserPermissions: called without guild for non-DM channel.");
                return Permissions.NONE;
            }
        }

        // check if we can resolve here to short-circuit possibly calling the database unnecessarily
        // TODO: do we want to have an instance-wide opt out of this behavior? It would just be an extra if statement here
        const ownerId = guild?.owner?.id ?? guild?.owner_id;
        if (!!opts.user_id && ownerId === opts.user_id) return Permissions.ALL;
        if (!!opts.user?.id && ownerId === opts.user?.id) return Permissions.ALL;
        if (!!opts.member?.id && ownerId === opts.member?.id) return Permissions.ALL;

        let member = opts.member;
        if (!member) {
            if (opts.user) member = await Member.findOneOrFail({ where: { guild_id: guild.id, id: opts.user.id }, relations: { roles: true } });
            else if (opts.user_id) member = await Member.findOneOrFail({ where: { guild_id: guild.id, id: opts.user_id }, relations: { roles: true } });
            else {
                console.error("Channel.getUserPermissions: called without user or member for non-DM channel.");
                return Permissions.NONE;
            }
        }

        const roles = (
            member.roles ||
            (
                await Member.findOneOrFail({
                    where: { guild_id: guild.id, index: member.index },
                    relations: { roles: true },
                    select: {
                        roles: {
                            id: true,
                            permissions: true,
                            position: true,
                        },
                    },
                    loadEagerRelations: false,
                })
            ).roles
        ).sort((a, b) => a.position - b.position); // ascending by position

        return Permissions.finalPermission({
            user: {
                ...member,
                roles: roles.map((r) => r.id),
                flags: member.user?.flags ?? (await User.findOneOrFail({ where: { id: member.id }, select: { flags: true } })).flags,
            },
            guild: { id: guild.id, owner_id: guild.owner_id!, roles }, // We don't care about including *all* guild roles, as not all of them are relevant...
            channel: this,
        });
    }

    // TODO: should we throw for missing args?
    async canViewChannel(opts: { user_id?: string; user?: User; member?: Member; guild?: Guild }): Promise<boolean> {
        if (this.isDm()) return await this.canViewDmChannel(opts.user_id, opts.user);

        const userPerms = await this.getUserPermissions(opts);
        return userPerms.has("VIEW_CHANNEL");
    }

    private async canViewDmChannel(user_id?: string, user?: User): Promise<boolean> {
        const userId = user_id ?? user?.id;
        if (!userId) {
            console.error("Channel.canViewChannel: called without user for DM channel.");
            return false;
        }
        if (!user) return false;
        if (this.recipients) return this.recipients.some((r) => r.user_id === user.id && !r.closed);
        else {
            // we dont have recipients on hand
            const recipient = await Recipient.findOne({ where: { channel_id: this.id, user_id: user.id } });
            return recipient == null ? false : !recipient.closed;
        }
    }

    toJSON(): PublicChannel {
        return {
            ...this,
            last_pin_timestamp: this.last_pin_timestamp?.toISOString(),
            guild_id: this.guild_id ?? undefined,
            recipients: undefined, //this.recipients?.map(x=>x.user.toPublicUser()), // TODO: fix me
            owner: undefined, // TODO: fix me - this is thread owner

            // these fields are not returned depending on the type of channel
            bitrate: this.bitrate || undefined,
            user_limit: this.user_limit || undefined,
            rate_limit_per_user: this.rate_limit_per_user || undefined,
            owner_id: this.owner_id || undefined,
            ...(this.isThread() && this.thread_members ? { member_ids_preview: this.thread_members.map((_) => _.member.id) } : {}),
            default_auto_archive_duration: this.default_auto_archive_duration ?? undefined,
            retention_policy_id: undefined,
            thread_metadata: this.thread_metadata
                ? {
                      ...this.thread_metadata,
                      archive_timestamp: new Date(this.thread_metadata.archive_timestamp).toISOString().replace("Z", "+00:00"),
                      create_timestamp: new Date(this.thread_metadata.create_timestamp).toISOString().replace("Z", "+00:00"),
                  }
                : undefined,
            member_count: this.member_count ?? undefined,
            message_count: this.message_count ?? undefined,
            total_message_sent: this.total_message_sent ?? undefined,
            applied_tags: this.applied_tags ?? undefined,
            permission_overwrites: this.isThread() ? undefined : this.permission_overwrites,
        };
    }
}

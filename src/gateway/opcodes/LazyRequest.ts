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

import { getDatabase, Member, Session, User, Presence, Permissions, getMostRelevantSession, type Channel } from "@spacebar/util";
import { WebSocket, Payload, OPCODES, Send, subscribeGuildMemberEvent, buildLazyMemberListOperations } from "@spacebar/gateway";
import murmur from "murmurhash-js/murmurhash3_gc";
import { check } from "./instanceOf";
import { LazyRequestSchema } from "@spacebar/schemas";
import { assertGatewayChannelAccess } from "../util/Authorization";

// TODO: config: to list all members (even those who are offline) sorted by role, or just those who are online
// TODO: rewrite typeorm

async function getMembers(guild_id: string) {
    let members: Member[] = [];
    try {
        members =
            (await getDatabase()
                ?.getRepository(Member)
                .createQueryBuilder("member")
                .where("member.guild_id = :guild_id", { guild_id })
                .leftJoinAndSelect("member.roles", "role")
                .leftJoinAndSelect("member.user", "user")
                .leftJoinAndSelect("user.sessions", "session")
                .addSelect("user.settings")
                .addSelect("CASE WHEN session.status IS NULL OR session.status = 'offline' OR session.status = 'invisible' THEN 0 ELSE 1 END", "_status")
                .orderBy("_status", "DESC")
                .addOrderBy("role.position", "DESC")
                .addOrderBy("user.username", "ASC")
                .getMany()) ?? [];
    } catch (e) {
        console.error(`LazyRequest`, e);
    }

    return members ?? [];
}

function memberCanViewChannel(member: Member, channel: Channel, guildOwnerId?: string) {
    return Permissions.finalPermission({
        user: {
            id: member.id,
            roles: member.roles?.map((role) => role.id) ?? [],
            communication_disabled_until: member.communication_disabled_until ?? null,
            flags: member.user?.flags ?? 0,
        },
        guild: {
            id: member.guild_id,
            owner_id: guildOwnerId ?? "",
            roles: member.roles ?? [],
        },
        channel: {
            overwrites: channel.permission_overwrites,
        },
    }).has("VIEW_CHANNEL");
}

async function canUserViewChannel(guildId: string, channelId: string, userId: string) {
    try {
        await assertGatewayChannelAccess({
            userId,
            guildId,
            channelId,
            permission: "VIEW_CHANNEL",
        });
        return true;
    } catch {
        return false;
    }
}

function getRequestedRanges(ranges: unknown[]): [number, number][] {
    return ranges.map((range) => {
        if (!Array.isArray(range) || range.length !== 2) {
            throw new Error("range is not a valid array");
        }

        return range as [number, number];
    });
}

export async function onLazyRequest(this: WebSocket, { d }: Payload) {
    const startTime = Date.now();
    // TODO: check data
    check.call(this, LazyRequestSchema, d);
    // noinspection JSUnusedLocalSymbols - TODO: implement typing/activities subscriptions
    const { guild_id, typing, channels, activities, members } = d as LazyRequestSchema;
    const channel_id = Object.keys(channels || {})[0];
    const shouldAuthorizeChannel = Boolean(channel_id);
    const requiresAuthorizedChannel = Boolean(members?.length || shouldAuthorizeChannel);
    const authorized = shouldAuthorizeChannel
        ? await assertGatewayChannelAccess({
              userId: this.user_id,
              guildId: guild_id,
              channelId: channel_id,
              permission: "VIEW_CHANNEL",
          })
        : undefined;

    if (requiresAuthorizedChannel && !authorized) return;

    if (members) {
        // Client has requested a PRESENCE_UPDATE for specific member

        await Promise.all(
            members.map(async (x) => {
                if (!x) return;
                if (!(await canUserViewChannel(guild_id, authorized!.channel.id, x))) return;

                const didSubscribe = await subscribeGuildMemberEvent.call(this, guild_id, x);
                if (!didSubscribe) return;

                // if we didn't subscribe just now, this is a new subscription
                // and we should send a PRESENCE_UPDATE immediately

                const sessions = await Session.find({ where: { user_id: x } });
                const session = getMostRelevantSession(sessions);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (session?.status == "unknown") session.status = "online";
                const user = await User.getPublicUser(x);

                return Send(this, {
                    op: OPCODES.Dispatch,
                    s: this.sequence++,
                    t: "PRESENCE_UPDATE",
                    d: {
                        user: user,
                        activities: session?.activities || [],
                        client_status: session?.client_status,
                        status: session?.getPublicStatus() || "offline",
                    } as Presence,
                });
            }),
        );

        if (!channels) return;
    }

    if (!channels) return;

    if (!channel_id) return;

    const ranges = channels[channel_id];
    if (!Array.isArray(ranges)) throw new Error("Not a valid Array");

    const requestedRanges = getRequestedRanges(ranges);
    const guildMembers = await getMembers(guild_id);
    const visibleGuildMembers = guildMembers.filter((member) => memberCanViewChannel(member, authorized!.channel, authorized!.permissions.cache.guild?.owner_id));
    const member_count = visibleGuildMembers.length;
    const memberList = buildLazyMemberListOperations(visibleGuildMembers, guild_id, requestedRanges);

    let list_id = "everyone";

    const channel = authorized!.channel;
    if (channel.permission_overwrites) {
        const perms: string[] = [];

        channel.permission_overwrites.forEach((overwrite) => {
            const { id, allow, deny } = overwrite;

            if (BigInt(allow) & Permissions.FLAGS.VIEW_CHANNEL) perms.push(`allow:${id}`);
            else if (BigInt(deny) & Permissions.FLAGS.VIEW_CHANNEL) perms.push(`deny:${id}`);
        });

        if (perms.length > 0) {
            list_id = murmur(perms.sort().join(",")).toString();
        }
    }

    // TODO: unsubscribe member_events that are not in op.members

    await Promise.all(memberList.ops.flatMap((op) => op.members.map((member) => (member?.user.id ? subscribeGuildMemberEvent.call(this, guild_id, member.user.id) : undefined))));

    await Send(this, {
        op: OPCODES.Dispatch,
        s: this.sequence++,
        t: "GUILD_MEMBER_LIST_UPDATE",
        d: {
            ops: memberList.ops.map((x) => ({
                items: x.items,
                op: "SYNC",
                range: x.range,
            })),
            online_count: memberList.online_count,
            member_count,
            id: list_id,
            guild_id,
            groups: memberList.groups,
        },
    });

    console.log(`[Gateway/${this.user_id}] LAZY_REQUEST ${guild_id} ${channel_id} took ${Date.now() - startTime}ms`);
}

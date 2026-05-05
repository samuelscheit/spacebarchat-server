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

import { getDatabase, getPermission, listenEvent, Member, Session, User, Presence, Channel, Permissions, getMostRelevantSession } from "@spacebar/util";
import { WebSocket, Payload, handlePresenceUpdate, OPCODES, Send, buildLazyMemberListOperations } from "@spacebar/gateway";
import murmur from "murmurhash-js/murmurhash3_gc";
import { check } from "./instanceOf";
import { LazyRequestSchema } from "@spacebar/schemas";

// TODO: only show roles/members that have access to this channel
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

function getRequestedRanges(ranges: unknown[]): [number, number][] {
    return ranges.map((range) => {
        if (!Array.isArray(range) || range.length !== 2) {
            throw new Error("range is not a valid array");
        }

        return range as [number, number];
    });
}

async function subscribeToMemberEvents(this: WebSocket, user_id: string) {
    if (this.events[user_id]) return false; // already subscribed as friend
    if (this.member_events[user_id]) return false; // already subscribed in member list
    this.member_events[user_id] = await listenEvent(user_id, handlePresenceUpdate.bind(this), this.listen_options);
    return true;
}

export async function onLazyRequest(this: WebSocket, { d }: Payload) {
    const startTime = Date.now();
    // TODO: check data
    check.call(this, LazyRequestSchema, d);
    // noinspection JSUnusedLocalSymbols - TODO: implement typing/activities subscriptions
    const { guild_id, typing, channels, activities, members } = d as LazyRequestSchema;

    if (members) {
        // Client has requested a PRESENCE_UPDATE for specific member

        await Promise.all([
            members.map(async (x) => {
                if (!x) return;
                const didSubscribe = await subscribeToMemberEvents.call(this, x);
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
        ]);

        if (!channels) return;
    }

    if (!channels) return;

    const channel_id = Object.keys(channels || {})[0];
    if (!channel_id) return;

    const permissions = await getPermission(this.user_id, guild_id, channel_id);
    permissions.hasThrow("VIEW_CHANNEL");

    const ranges = channels[channel_id];
    if (!Array.isArray(ranges)) throw new Error("Not a valid Array");

    const requestedRanges = getRequestedRanges(ranges);
    const [member_count, guildMembers] = await Promise.all([Member.count({ where: { guild_id } }), getMembers(guild_id)]);
    const memberList = buildLazyMemberListOperations(guildMembers, guild_id, requestedRanges);

    let list_id = "everyone";

    const channel = await Channel.findOneOrFail({
        where: { id: channel_id },
    });
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

    memberList.ops.forEach((op) => {
        op.members.forEach(async (member) => {
            if (!member?.user.id) return;
            return subscribeToMemberEvents.call(this, member.user.id);
        });
    });

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

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

import { Config, Member, Session, User, Presence, Permissions, getMostRelevantSession, type Channel } from "@spacebar/util";
import { WebSocket, Payload, OPCODES, Send, subscribeGuildMemberEvent, buildLazyMemberListOperations } from "@spacebar/gateway";
import murmur from "murmurhash-js/murmurhash3_gc";
import { check } from "./instanceOf";
import { LazyRequestSchema } from "@spacebar/schemas";
import { assertGatewayChannelAccess } from "../util/Authorization";
import { unsubscribeGuildMemberEventIds } from "../listener/subscriptions";

const OFFLINE_LAZY_MEMBER_LIST_STATUSES = ["offline", "invisible"] as const;

function hasOnlineLazyMemberSession(member: Member) {
    return Boolean(member.user?.sessions?.some((session) => session.status != null && !(OFFLINE_LAZY_MEMBER_LIST_STATUSES as readonly string[]).includes(session.status)));
}

async function getMembers(guild_id: string) {
    let members: Member[] = [];
    try {
        const includeOffline = Config.get().gateway.lazyMemberListIncludeOffline !== false;
        members = await Member.find({
            where: { guild_id },
            relations: {
                roles: true,
                user: {
                    sessions: true,
                    settings: true,
                },
            },
        });
        if (!includeOffline) members = members.filter(hasOnlineLazyMemberSession);
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

        const [start, end] = range;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
            throw new Error("range bounds must be safe integers");
        }

        if (start < 0 || end < 0) {
            throw new Error("range bounds must be non-negative");
        }

        if (start > end) {
            throw new Error("range start must be less than or equal to range end");
        }

        return [start, end];
    });
}

function getLazyMemberIds(memberList: ReturnType<typeof buildLazyMemberListOperations>) {
    return new Set(memberList.ops.flatMap((op) => op.members.map((member) => member?.user.id).filter((userId): userId is string => Boolean(userId))));
}

function validateRequestedMembers(members: unknown) {
    if (members === undefined) return;

    if (!Array.isArray(members)) {
        throw new Error("members must be an array");
    }

    for (const member of members) {
        if (typeof member !== "string") {
            throw new Error("member id must be a string");
        }
    }
}

function getRequestedChannelRanges(channels: LazyRequestSchema["channels"] | undefined) {
    const [channel_id, ranges] = Object.entries(channels ?? {})[0] ?? [];
    if (!channel_id) return { channel_id, requestedRanges: undefined };

    if (!Array.isArray(ranges)) throw new Error("range list is not a valid array");

    return {
        channel_id,
        requestedRanges: getRequestedRanges(ranges),
    };
}

async function unsubscribeStaleGuildMemberEvents(socket: WebSocket, guildId: string, subscribedUserIds: Set<string>) {
    const trackedUserIds = socket.guild_member_event_ids[guildId];
    if (!trackedUserIds?.size) return;

    const staleUserIds = [...trackedUserIds].filter((userId) => !subscribedUserIds.has(userId));
    if (!staleUserIds.length) return;

    await unsubscribeGuildMemberEventIds(socket.member_events, socket.guild_member_event_ids, socket.member_event_guild_ids, guildId, staleUserIds);
}

export async function onLazyRequest(this: WebSocket, { d }: Payload) {
    const startTime = Date.now();
    check.call(this, LazyRequestSchema, d);
    const { guild_id, channels, members } = d as LazyRequestSchema;
    validateRequestedMembers(members);
    const { channel_id, requestedRanges } = getRequestedChannelRanges(channels);
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

    const subscribedUserIds = new Set<string>();
    if (members) {
        // Client has requested a PRESENCE_UPDATE for specific member

        await Promise.all(
            members.map(async (x) => {
                if (!x) return;
                if (!(await canUserViewChannel(guild_id, authorized!.channel.id, x))) return;

                subscribedUserIds.add(x);
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

    if (!channel_id || !requestedRanges) return;

    const guildMembers = await getMembers(guild_id);
    const visibleGuildMembers = guildMembers.filter((member) => memberCanViewChannel(member, authorized!.channel, authorized!.guildOwnerId));
    const member_count = visibleGuildMembers.length;
    const memberList = buildLazyMemberListOperations(visibleGuildMembers, guild_id, requestedRanges);
    for (const userId of getLazyMemberIds(memberList)) subscribedUserIds.add(userId);

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

    await Promise.all([...subscribedUserIds].map((userId) => subscribeGuildMemberEvent.call(this, guild_id, userId)));
    await unsubscribeStaleGuildMemberEvents(this, guild_id, subscribedUserIds);

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

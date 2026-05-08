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

import { randomString, route } from "@spacebar/api";
import { Channel, Config, DiscordApiErrors, Guild, Invite, Member, Permissions, normalizeInviteCreateOptions } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { ChannelType, GuildWidgetJsonResponse } from "@spacebar/schemas";
import { In } from "typeorm";

const router: Router = Router({ mergeParams: true });
const widgetMemberSampleLimit = 100;
const onlineSessionWindowMs = 1000 * 60 * 5;

// Undocumented API notes:
// An invite is created for the widget_channel_id on request (only if an existing one created by the widget doesn't already exist)
// This invite created doesn't include an inviter object like user created ones and has a default expiry of 24 hours
// Missing user object information is intentional (https://github.com/discord/discord-api-docs/issues/1287)
// channels returns voice channel objects where @everyone has the CONNECT permission
// members (max 100 returned) is a sample of all members, and bots par invisible status, there exists some alphabetical distribution pattern between the members returned

// https://discord.com/developers/docs/resources/guild#get-guild-widget
const expiryTime = 1000 * 60 * 5; // 5 minutes
const jsonDataCache = new Map<string, { data: Promise<GuildWidgetJsonResponse>; expiry: Date }>();

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "GuildWidgetJsonResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        let cacheEntry = jsonDataCache.get(guild_id);
        if (!cacheEntry || cacheEntry.expiry.getTime() < Date.now()) {
            // Create new cache entry
            const dataPromise = getWidgetJsonData(guild_id);
            cacheEntry = {
                data: dataPromise,
                expiry: new Date(Date.now() + expiryTime),
            };
            console.log("[Widget] Caching widget data for guild", guild_id);
            jsonDataCache.set(guild_id, cacheEntry);
        }

        const cacheRemainingSeconds = Math.floor((cacheEntry.expiry.getTime() - Date.now()) / 1000);
        res.set("Cache-Control", `public, max-age=${cacheRemainingSeconds}, s-maxage=${cacheRemainingSeconds}, immutable`);
        return res.json(await cacheEntry.data);
    },
);

async function getWidgetJsonData(guild_id: string) {
    const guild = await Guild.findOneOrFail({
        where: { id: guild_id },
        select: {
            channel_ordering: true,
            widget_channel_id: true,
            widget_enabled: true,
            presence_count: true,
            name: true,
        },
    });
    if (!guild.widget_enabled) throw DiscordApiErrors.EMBED_DISABLED;

    // Fetch existing widget invite for widget channel
    let invite = await Invite.findOne({
        where: { channel_id: guild.widget_channel_id },
    });

    if (guild.widget_channel_id && !invite) {
        invite = await Invite.createForChannel(
            randomString(),
            {
                guild_id,
                channel_id: guild.widget_channel_id,
            },
            normalizeInviteCreateOptions({}),
        ).save();
    }

    // Fetch voice channels, and the @everyone permissions object
    const channels: { id: string; name: string; position: number }[] = [];

    (await Channel.getOrderedChannels(guild.id, guild)).forEach((doc) => {
        if (doc.type !== ChannelType.GUILD_VOICE) return;
        // Only return voice channels where @everyone has the CONNECT permission
        if (doc.permission_overwrites === undefined || Permissions.channelPermission(doc.permission_overwrites, Permissions.FLAGS.CONNECT) === Permissions.FLAGS.CONNECT) {
            channels.push({
                id: doc.id,
                name: doc.name ?? "Unknown channel",
                position: doc.position ?? 0,
            });
        }
    });

    const onlineMembers = await getWidgetMemberSample(guild_id);
    const memberData: GuildWidgetJsonResponse["members"] = onlineMembers.map((x) => toWidgetMember(guild_id, x)).sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)));

    // Construct object to respond with
    return {
        id: guild_id,
        name: guild.name,
        instant_invite: invite?.code ?? null,
        channels: channels,
        members: memberData,
        presence_count: guild.presence_count || onlineMembers.length,
    } satisfies GuildWidgetJsonResponse;
}

export async function getWidgetMemberSample(guild_id: string, now = Date.now()) {
    const minLastSeen = new Date(now - onlineSessionWindowMs);
    const sampledMemberIds = await Member.createQueryBuilder("member")
        .select("member.id", "id")
        .innerJoin("member.user", "user")
        .innerJoin("user.sessions", "session", "session.last_seen > :minLastSeen", { minLastSeen })
        .where({ guild_id })
        .andWhere("session.status NOT IN (:...hiddenStatuses)", { hiddenStatuses: ["invisible", "offline"] })
        .groupBy("member.id")
        .orderBy("RANDOM()")
        .take(widgetMemberSampleLimit)
        .getRawMany<{ id: string }>();

    const memberIds = sampledMemberIds.map((member) => member.id);
    if (memberIds.length === 0) return [];

    const sampledMembers = await Member.find({
        where: { guild_id, id: In(memberIds) },
        relations: { user: { sessions: true } },
    });
    const membersById = new Map(sampledMembers.map((member) => [member.id, member]));

    return memberIds
        .map((id) => membersById.get(id))
        .filter((member): member is Member => member !== undefined)
        .slice(0, widgetMemberSampleLimit);
}

export function toWidgetMember(guild_id: string, member: Member): GuildWidgetJsonResponse["members"][number] {
    return {
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: null,
        status: "online" as const, // TODO
        avatar_url: member.avatar
            ? `${Config.get().cdn.endpointPublic}/guilds/${guild_id}/users/${member.id}/avatars/${member.avatar}.png`
            : member.user.avatar
              ? `${Config.get().cdn.endpointPublic}/avatars/${member.id}/${member.user.avatar}.png`
              : `${Config.get().cdn.endpointPublic}/embed/avatars/${BigInt(member.id) % 6n}.png`,
    };
}

export default router;

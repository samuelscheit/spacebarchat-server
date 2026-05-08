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

import { Config, Guild, GuildFeature, Member } from "@spacebar/util";

import { createDiscoverableGuildCategoryFilter, route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { ArrayContains, In, Not } from "typeorm";
import { type DiscoverableGuildsResponse, toDiscoverableGuild } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        query: {
            offset: {
                type: "number",
                description: "The number of discoverable guilds to skip before returning results.",
            },
            limit: {
                type: "number",
                description: "The maximum number of discoverable guilds to return.",
            },
            categories: {
                type: "string",
                description: "Filter by one or more primary category IDs. May be repeated or comma-separated.",
            },
        },
        responses: {
            200: {
                body: "DiscoverableGuildsResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { offset, limit, categories } = req.query;
        const categoryFilter = createDiscoverableGuildCategoryFilter(categories);
        const showAllGuilds = Config.get().guild.discovery.showAllGuilds;
        const configLimit = Config.get().guild.discovery.limit;
        const hideJoinedGuilds = Config.get().guild.discovery.hideJoinedGuilds;
        const hiddenGuildIds = hideJoinedGuilds
            ? await Member.find({
                  where: { id: req.user_id },
                  select: { guild_id: true },
              }).then((members) => members.map((member) => member.guild_id))
            : [];

        const guilds = await Guild.find({
            where: {
                id: Not(In(hiddenGuildIds)),
                discovery_excluded: false,
                ...(categoryFilter == undefined ? {} : { primary_category_id: categoryFilter }),
                ...(showAllGuilds ? {} : { features: ArrayContains([GuildFeature.Discoverable]) }),
            },
            order: {
                discovery_weight: "DESC",
                member_count: "DESC",
            },
            skip: Math.abs(Number(offset || Config.get().guild.discovery.offset)),
            take: Math.abs(Number(limit || configLimit)),
        });

        const total = guilds.length;

        const response = {
            total: total,
            guilds: guilds.map(toDiscoverableGuild),
            offset: Number(offset || Config.get().guild.discovery.offset),
            limit: Number(limit || configLimit),
        } satisfies DiscoverableGuildsResponse;

        return res.send(response);
    },
);

export default router;

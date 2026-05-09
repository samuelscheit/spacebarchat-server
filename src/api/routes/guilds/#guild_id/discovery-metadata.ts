/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { DISCOVERABLE_FEATURE, assertCanPublishGuildDiscovery, getGuildDiscoveryMetadataUpdate, route, toGuildDiscoveryMetadata } from "@spacebar/api";
import { Guild } from "@spacebar/util";
import { GuildDiscoveryMetadataUpdateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "GuildDiscoveryMetadataResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true, primary_category_id: true, features: true, description: true },
        });

        res.json(toGuildDiscoveryMetadata(guild));
    },
);

router.patch(
    "/",
    route({
        permission: "MANAGE_GUILD",
        permissionOrRight: "MANAGE_GUILDS",
        requestBody: "GuildDiscoveryMetadataUpdateSchema",
        responses: {
            200: {
                body: "GuildDiscoveryMetadataResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        const body = req.body as GuildDiscoveryMetadataUpdateSchema;
        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true, primary_category_id: true, features: true, description: true, discovery_excluded: true },
        });

        if (body.is_published === true && !guild.features.includes(DISCOVERABLE_FEATURE)) {
            assertCanPublishGuildDiscovery(guild, req.rights);
        }

        const update = getGuildDiscoveryMetadataUpdate(guild, body);
        if (Object.keys(update).length) {
            await Guild.update({ id: guild_id }, update);
            Object.assign(guild, update);
        }

        res.json(toGuildDiscoveryMetadata(guild));
    },
);

export default router;

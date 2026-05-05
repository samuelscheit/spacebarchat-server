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

import { route, toGuildDiscoveryMetadata } from "@spacebar/api";
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
            select: { id: true, primary_category_id: true, features: true, description: true },
        });

        if (body.primary_category_id !== undefined) {
            guild.primary_category_id = body.primary_category_id === null ? undefined : body.primary_category_id.toString();
        }

        if (body.about !== undefined) {
            guild.description = body.about ?? undefined;
        }

        if (body.is_published !== undefined) {
            guild.features = guild.features ?? [];
            if (body.is_published && !guild.features.includes("DISCOVERABLE")) guild.features.push("DISCOVERABLE");
            if (!body.is_published) guild.features = guild.features.filter((feature) => feature !== "DISCOVERABLE");
        }

        if (body.primary_category_id !== undefined || body.about !== undefined || body.is_published !== undefined) await guild.save();

        res.json(toGuildDiscoveryMetadata(guild));
    },
);

export default router;

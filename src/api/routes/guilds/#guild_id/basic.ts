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

import { route } from "@spacebar/api";
import { ApiError, DiscordApiErrors, Guild, GuildFeature, Member } from "@spacebar/util";
import { type GuildBasicResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });
const unknownGuild = new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);

export type GuildBasicSource = Pick<Guild, "id" | "name" | "icon" | "description" | "splash" | "discovery_splash" | "features">;
type GuildBasicAccessSource = GuildBasicSource & Pick<Guild, "discovery_excluded">;

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "GuildBasicResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        return res.json(await getGuildBasicResponse(guild_id, req.user_id));
    },
);

export async function getGuildBasicResponse(guildId: string, userId: string): Promise<GuildBasicResponse> {
    const guild = await Guild.findOne({
        where: { id: guildId },
        select: {
            id: true,
            name: true,
            icon: true,
            description: true,
            splash: true,
            discovery_splash: true,
            features: true,
            discovery_excluded: true,
        },
    });
    if (!guild) throw unknownGuild;

    const member = await Member.findOne({
        where: { guild_id: guildId, id: userId },
        select: { id: true },
    });
    if (!member && !isGuildBasicVisibleToNonMember(guild)) throw unknownGuild;

    return toGuildBasicResponse(guild);
}

export function toGuildBasicResponse(guild: GuildBasicSource): GuildBasicResponse {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
        description: guild.description ?? null,
        splash: guild.splash ?? null,
        discovery_splash: guild.discovery_splash ?? null,
        features: guild.features,
    };
}

function isGuildBasicVisibleToNonMember(guild: GuildBasicAccessSource) {
    return guild.features.includes(GuildFeature.Discoverable) && !guild.discovery_excluded;
}

export default router;

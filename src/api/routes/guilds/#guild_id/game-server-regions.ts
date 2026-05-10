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

import { assertGuildMember, route } from "@spacebar/api";
import type { GameServerRegionsResponse } from "@spacebar/schemas";
import { Config, Guild, type GameServerRegionConfiguration } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

type GameServerRegionCandidate = Partial<Record<keyof GameServerRegionConfiguration, unknown>>;

function isConfiguredGameServerRegion(region: unknown): region is GameServerRegionConfiguration {
    if (!region || typeof region !== "object") return false;

    const candidate = region as GameServerRegionCandidate;
    return (
        typeof candidate.id === "string" &&
        candidate.id.length > 0 &&
        typeof candidate.name === "string" &&
        candidate.name.length > 0 &&
        typeof candidate.country_code === "string" &&
        candidate.country_code.length > 0 &&
        typeof candidate.ping_url === "string" &&
        candidate.ping_url.length > 0
    );
}

export function getConfiguredGameServerRegions(regions: unknown = Config.get().guild.gameServerRegions): GameServerRegionsResponse {
    if (!Array.isArray(regions)) return [];

    return regions.filter(isConfiguredGameServerRegion).map(({ id, name, country_code, ping_url }) => ({
        id,
        name,
        country_code,
        ping_url,
    }));
}

router.get(
    "/",
    route({
        summary: "Get Guild Game Server Regions",
        responses: {
            200: {
                body: "GameServerRegionsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        await Guild.findOneOrFail({ where: { id: guild_id }, select: { id: true } });
        await assertGuildMember(req.user_id, guild_id);

        return res.json(getConfiguredGameServerRegions());
    },
);

export default router;

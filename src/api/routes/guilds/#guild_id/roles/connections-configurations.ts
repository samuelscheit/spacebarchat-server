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
import type { GuildRoleConnectionsConfigurationsResponse } from "@spacebar/schemas";
import { Member } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildRoleConnectionsConfigurationsProvider = (guildId: string) => GuildRoleConnectionsConfigurationsResponse | Promise<GuildRoleConnectionsConfigurationsResponse>;

export function getGuildRoleConnectionsConfigurations(_guildId: string): GuildRoleConnectionsConfigurationsResponse {
    return [];
}

export function registerGuildRoleConnectionsConfigurationsRoute(router: Router, provider: GuildRoleConnectionsConfigurationsProvider = getGuildRoleConnectionsConfigurations) {
    router.get(
        "/",
        route({
            summary: "Get Guild Role Connections Configurations",
            description:
                "Returns locally persisted linked-role connection rules for a guild. Spacebar does not currently persist Discord linked-role configuration state, so this compatibility endpoint returns an empty list for guild members instead of fabricating role requirements.",
            responses: {
                200: {
                    body: "GuildRoleConnectionsConfigurationsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const guildId = req.params.guild_id as string;

            await Member.IsInGuildOrFail(req.user_id, guildId);

            const configurations = await provider(guildId);

            return res.json(configurations);
        },
    );

    return router;
}

export function createGuildRoleConnectionsConfigurationsRouter(provider: GuildRoleConnectionsConfigurationsProvider = getGuildRoleConnectionsConfigurations) {
    return registerGuildRoleConnectionsConfigurationsRoute(Router({ mergeParams: true }), provider);
}

export default createGuildRoleConnectionsConfigurationsRouter();

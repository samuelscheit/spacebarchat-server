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
import type { GuildRoleConnectionConfigurationResponse } from "@spacebar/schemas";
import { Role } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildRoleConnectionConfigurationProvider = (
    guildId: string,
    roleId: string,
) => GuildRoleConnectionConfigurationResponse | Promise<GuildRoleConnectionConfigurationResponse>;

export function getGuildRoleConnectionConfiguration(_guildId: string, _roleId: string): GuildRoleConnectionConfigurationResponse {
    return [];
}

export function registerGuildRoleConnectionConfigurationRoute(router: Router, provider: GuildRoleConnectionConfigurationProvider = getGuildRoleConnectionConfiguration) {
    router.get(
        "/",
        route({
            summary: "Get Guild Role Connection Configuration",
            description:
                "Returns the locally persisted linked-role requirements for one guild role. Spacebar does not currently persist Discord linked-role configuration state, so this compatibility endpoint returns an empty configuration for existing guild roles instead of fabricating requirements.",
            permission: "MANAGE_ROLES",
            responses: {
                200: {
                    body: "GuildRoleConnectionConfigurationResponse",
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
            const { guild_id: guildId, role_id: roleId } = req.params as { guild_id: string; role_id: string };

            await Role.findOneOrFail({
                where: { guild_id: guildId, id: roleId },
                select: { id: true },
            });

            const configuration = await provider(guildId, roleId);

            return res.json(configuration);
        },
    );

    return router;
}

export function createGuildRoleConnectionConfigurationRouter(provider: GuildRoleConnectionConfigurationProvider = getGuildRoleConnectionConfiguration) {
    return registerGuildRoleConnectionConfigurationRoute(Router({ mergeParams: true }), provider);
}

export default createGuildRoleConnectionConfigurationRouter();

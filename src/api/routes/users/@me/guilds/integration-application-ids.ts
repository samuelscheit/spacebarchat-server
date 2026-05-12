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

import { listUserGuildIntegrationApplicationIds, route } from "@spacebar/api";
import type { GuildIntegrationApplicationIdsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export interface UserGuildIntegrationApplicationIdsDependencies {
    listIntegrationApplicationIds?: typeof listUserGuildIntegrationApplicationIds;
}

export function createUserGuildIntegrationApplicationIdsRouter(dependencies: UserGuildIntegrationApplicationIdsDependencies = {}) {
    const router: Router = Router({ mergeParams: true });
    const listIntegrationApplicationIds = dependencies.listIntegrationApplicationIds ?? listUserGuildIntegrationApplicationIds;

    router.get(
        "/",
        route({
            summary: "Get Guild Integration Application IDs",
            description: "Returns a mapping of guild IDs to application IDs for locally backed application integrations in the current user's guilds.",
            responses: {
                200: {
                    body: "GuildIntegrationApplicationIdsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const applicationIdsByGuildId: GuildIntegrationApplicationIdsResponse = await listIntegrationApplicationIds(req.user_id);

            return res.json(applicationIdsByGuildId);
        },
    );

    return router;
}

export default createUserGuildIntegrationApplicationIdsRouter();

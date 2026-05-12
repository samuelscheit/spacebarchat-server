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
import type { GuildRoleSubscriptionListingTemplatesResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export function getGuildRoleSubscriptionListingTemplates(_guildId: string): GuildRoleSubscriptionListingTemplatesResponse {
    // Spacebar does not persist Discord guild role-subscription listing template state.
    return [];
}

export function createGuildRoleSubscriptionListingTemplatesRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Role Subscription Listing Templates",
            description:
                "Returns locally backed role-subscription listing templates for a guild. Spacebar does not currently persist Discord role-subscription template state, so this compatibility endpoint returns an empty list after MANAGE_GUILD access checks.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildRoleSubscriptionListingTemplatesResponse",
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
        (req: Request, res: Response) => {
            res.status(200).json(getGuildRoleSubscriptionListingTemplates(req.params.guild_id as string));
        },
    );

    return router;
}

export default createGuildRoleSubscriptionListingTemplatesRouter();

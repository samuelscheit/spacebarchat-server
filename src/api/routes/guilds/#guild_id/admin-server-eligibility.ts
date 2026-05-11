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
import type { GuildAdminServerEligibilityResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export function getGuildAdminServerEligibilityResponse(): GuildAdminServerEligibilityResponse {
    // Spacebar does not operate Discord's Admin Community or persist Admin Community join state.
    // Keep the compatibility endpoint conservative until that product state exists.
    return { eligible_for_admin_server: false };
}

router.get(
    "/",
    route({
        permission: "MANAGE_GUILD",
        summary: "Get Admin Community Eligibility",
        responses: {
            200: {
                body: "GuildAdminServerEligibilityResponse",
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
        await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true },
        });

        res.json(getGuildAdminServerEligibilityResponse());
    },
);

export default router;

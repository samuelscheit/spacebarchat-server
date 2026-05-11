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
import type { GuildOnboardingAllowedApplicationsResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function buildGuildOnboardingAllowedApplicationsResponse(): GuildOnboardingAllowedApplicationsResponse {
    return { application_ids: [] };
}

router.get(
    "/",
    route({
        summary: "Get Guild Onboarding Allowed Applications",
        description:
            "Returns the application IDs that can be used as onboarding application connections. Spacebar does not currently persist Discord's onboarding connection allowlist, so the locally backed fail-closed response is an empty list.",
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "GuildOnboardingAllowedApplicationsResponse",
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
        const guildId = req.params.guild_id as string;

        await Guild.findOneOrFail({
            where: { id: guildId },
            select: { id: true },
        });

        return res.status(200).json(buildGuildOnboardingAllowedApplicationsResponse());
    },
);

export default router;

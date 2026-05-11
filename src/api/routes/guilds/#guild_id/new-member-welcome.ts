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
import type { GuildNewMemberWelcomeResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export type CurrentGuildNewMemberWelcome = GuildNewMemberWelcomeResponse | null;

export async function getCurrentGuildNewMemberWelcome(guildId: string): Promise<CurrentGuildNewMemberWelcome> {
    void guildId;
    // Spacebar does not persist Discord's new member welcome/home settings yet.
    return null;
}

router.get(
    "/",
    route({
        summary: "Get Guild New Member Welcome",
        description:
            "Returns the guild's new member welcome configuration when persisted state exists; otherwise returns 204 with no body. Spacebar currently has no durable new member welcome store, so disabled or absent state requires MANAGE_GUILD.",
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "GuildNewMemberWelcomeResponse",
            },
            204: {},
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

        const welcome = await getCurrentGuildNewMemberWelcome(guildId);
        if (welcome === null) return res.sendStatus(204);

        return res.status(200).json(welcome);
    },
);

export default router;

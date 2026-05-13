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
import type { GuildMfaLevelResponse, GuildMfaLevelSchema } from "@spacebar/schemas";
import { Guild, type GuildUpdateEvent, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "GuildMfaLevelSchema",
        coerceRequestBody: false,
        summary: "Modify Guild MFA Level",
        responses: {
            200: {
                body: "GuildMfaLevelResponse",
            },
            400: {
                body: "APIErrorResponse",
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
        const { level } = req.body as GuildMfaLevelSchema;

        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            relations: { emojis: true, roles: true, stickers: true },
        });

        if (guild.owner_id !== req.user_id) throw new HTTPError("You are not the owner of this guild", 401);

        guild.mfa_level = level;
        await guild.save();

        await emitEvent({
            event: "GUILD_UPDATE",
            data: guild.toGuildUpdateEventData(),
            guild_id,
        } satisfies GuildUpdateEvent);

        return res.json({ level } satisfies GuildMfaLevelResponse);
    },
);

export default router;

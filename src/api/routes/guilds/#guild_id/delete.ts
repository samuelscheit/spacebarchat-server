/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { assertMfaCode, consumeMfaBackupCode, route } from "@spacebar/api";
import { Guild, GuildDeleteEvent, User, emitEvent, getDatabase } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { GuildDeleteSchema } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

// discord prefixes this route with /delete instead of using the delete method
// docs are wrong https://discord.com/developers/docs/resources/guild#delete-guild
router.post(
    "/",
    route({
        requestBody: {
            schema: "GuildDeleteSchema",
            required: false,
        },
        responses: {
            204: {},
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
        const { code } = (req.body ?? {}) as GuildDeleteSchema;

        const guild = await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { owner_id: true },
        });
        if (guild.owner_id !== req.user_id) throw new HTTPError("You are not the owner of this guild", 401);

        const user = await User.findOneOrFail({
            where: { id: req.user_id },
            select: { id: true, mfa_enabled: true, totp_secret: true },
        });

        await getDatabase()!.transaction(async (manager) => {
            await assertMfaCode({
                code,
                mfa_enabled: user.mfa_enabled,
                totp_secret: user.totp_secret,
                invalidCodeError: () => new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008),
                consumeBackupCode: (code) => consumeMfaBackupCode({ code, manager, userId: req.user_id }),
            });

            await manager.delete(Guild, { id: guild_id }); // this will also delete all guild related data
        });

        await emitEvent({
            event: "GUILD_DELETE",
            data: {
                id: guild_id,
            },
            guild_id: guild_id,
        } satisfies GuildDeleteEvent);

        return res.sendStatus(204);
    },
);

export default router;

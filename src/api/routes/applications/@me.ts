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

import { route } from "@spacebar/api";
import { Application, DiscordApiErrors, Guild, applyApplicationModifySchema, handleFile } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { ApplicationModifySchema } from "@spacebar/schemas";

const router: Router = Router({ mergeParams: true });

export async function getCurrentBotApplication(userId: string) {
    const app = await Application.findOneOrFail({
        where: { id: userId },
        relations: { owner: true, bot: true },
    });

    if (!app.bot || app.bot.id !== userId) throw DiscordApiErrors.BOT_ONLY_ENDPOINT;

    return app;
}

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "Application",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const app = await getCurrentBotApplication(req.user_id);

        return res.json(app);
    },
);

router.patch(
    "/",
    route({
        requestBody: "ApplicationModifySchema",
        coerceRequestBody: false,
        responses: {
            200: {
                body: "Application",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as ApplicationModifySchema;

        const app = await getCurrentBotApplication(req.user_id);

        if (body.icon) {
            body.icon = await handleFile(`/app-icons/${app.id}`, body.icon as string);
        }
        if (body.cover_image) {
            body.cover_image = await handleFile(`/app-icons/${app.id}`, body.cover_image as string);
        }

        if (body.guild_id) {
            const guild = await Guild.findOneOrFail({
                where: { id: body.guild_id },
                select: { owner_id: true },
            });
            if (guild.owner_id != app.owner.id) throw new HTTPError("You must be the owner of the guild to link it to an application", 400);
        }

        if (app.bot) {
            app.bot.assign({ bio: body.description });
            await app.bot.save();
        }

        applyApplicationModifySchema(app, body);

        await app.save();

        return res.json(app);
    },
);

export default router;

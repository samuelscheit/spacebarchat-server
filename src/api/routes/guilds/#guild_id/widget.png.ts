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
import { DiscordApiErrors, Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { storage } from "@spacebar/cdn";
import { isWidgetStyle, renderWidgetPng, WIDGET_STYLE_ERROR } from "../../../util/utility/WidgetPng";

const router: Router = Router({ mergeParams: true });

// TODO: use svg templates to make widget themes easier to edit

// https://discord.com/developers/docs/resources/guild#get-guild-widget-image
// TODO: Cache the response
router.get(
    "/",
    route({
        responses: {
            200: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        const guild = await Guild.findOneOrFail({ where: { id: guild_id } });
        if (!guild.widget_enabled) throw DiscordApiErrors.EMBED_DISABLED;

        // Fetch parameter
        const style = req.query.style?.toString() || "shield";
        if (!isWidgetStyle(style)) {
            throw new HTTPError(WIDGET_STYLE_ERROR, 400);
        }

        const icon = guild.icon ? await storage.get(`avatars/${guild_id}/${guild.icon}`) : undefined;
        const buffer = await renderWidgetPng({
            style,
            name: guild.name,
            presenceCount: guild.presence_count,
            icon,
        });

        // Return final image
        res.set("Content-Type", "image/png");
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(buffer);
    },
);

export default router;

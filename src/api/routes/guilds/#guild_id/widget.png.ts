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
import { storage } from "@spacebar/cdn";
import { parseWidgetImageStyle, renderGuildWidgetPng } from "../GuildWidgetPngRenderer";

const router: Router = Router({ mergeParams: true });

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

        const style = parseWidgetImageStyle(req.query.style?.toString() || "shield");
        const iconDataUri = guild.icon ? await getGuildIconDataUri(guild_id, guild.icon) : undefined;
        const png = await renderGuildWidgetPng({
            style,
            name: guild.name,
            presence: `${guild.presence_count} ONLINE`,
            iconDataUri,
        });

        res.set("Content-Type", "image/png");
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(png);
    },
);

async function getGuildIconDataUri(guild_id: string, icon: string): Promise<string | undefined> {
    const iconPath = `avatars/${guild_id}/${icon}`;
    const iconBuffer = await storage.get(iconPath).catch(() => undefined);
    if (!iconBuffer) return undefined;

    return `data:${getImageMimeType(iconBuffer)};base64,${iconBuffer.toString("base64")}`;
}

function getImageMimeType(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
    if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return "image/png";
}

export default router;

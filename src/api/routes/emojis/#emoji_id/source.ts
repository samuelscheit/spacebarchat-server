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
import { Emoji, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { APIErrorResponse, type EmojiSourceResponse } from "@spacebar/schemas";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "EmojiSourceResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { emoji_id } = req.params as { [key: string]: string };

        const emoji = await Emoji.findOne({ where: { id: emoji_id } });
        if (!emoji) {
            res.status(404).json({
                code: DiscordApiErrors.UNKNOWN_EMOJI.code,
                message: `No emoji with ID ${emoji_id} appear to exist. Are you sure you didn't mistype it?`,
                errors: {},
            } as APIErrorResponse);
            return;
        }

        const guild = await Guild.findOne({
            where: {
                id: emoji.guild_id,
            },
            relations: {
                emojis: true,
            },
            select: {
                id: true,
                name: true,
                icon: true,
                description: true,
                features: true,
                premium_tier: true,
                premium_subscription_count: true,
                emojis: {
                    id: true,
                    animated: true,
                    available: true,
                    managed: true,
                    name: true,
                    require_colons: true,
                    roles: true,
                },
            },
        });
        if (!guild) {
            res.status(404).json({
                code: DiscordApiErrors.UNKNOWN_EMOJI.code,
                message: `No emoji with ID ${emoji_id} appear to exist. Are you sure you didn't mistype it?`,
                errors: {},
            } as APIErrorResponse);
            return;
        }

        const response: EmojiSourceResponse = {
            type: "GUILD",
            guild: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon ?? null,
                description: guild.description ?? null,
                features: guild.features,
                emojis: guild.emojis.map((guildEmoji) => ({
                    id: guildEmoji.id,
                    animated: guildEmoji.animated,
                    available: guildEmoji.available,
                    managed: guildEmoji.managed,
                    name: guildEmoji.name,
                    require_colons: guildEmoji.require_colons,
                    roles: guildEmoji.roles,
                })),
                premium_tier: guild.premium_tier ?? 0,
                premium_subscription_count: guild.premium_subscription_count ?? null,
                approximate_member_count: await Member.countBy({
                    guild_id: emoji.guild_id,
                }),
                approximate_presence_count: await Member.countBy({
                    guild_id: emoji.guild_id,
                    user: {
                        sessions: {
                            status: "online",
                        },
                    },
                }),
            },
        };

        res.json(response);
    },
);

export default router;

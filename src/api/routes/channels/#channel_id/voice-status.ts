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
import { Channel, DiscordApiErrors, emitEvent, VoiceState, type VoiceChannelStatusUpdateEvent } from "@spacebar/util";
import { ChannelType, type VoiceChannelStatusModifySchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

async function isConnectedToVoiceChannel(channelId: string, userId: string): Promise<boolean> {
    return (
        (await VoiceState.count({
            where: {
                channel_id: channelId,
                user_id: userId,
            },
        })) > 0
    );
}

router.put(
    "/",
    route({
        requestBody: "VoiceChannelStatusModifySchema",
        coerceRequestBody: false,
        permission: "SET_VOICE_CHANNEL_STATUS",
        event: "VOICE_CHANNEL_STATUS_UPDATE",
        summary: "Modify Channel Status",
        description: "Sets a voice channel's status.",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
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
        const { channel_id } = req.params as { [key: string]: string };
        const body = req.body as VoiceChannelStatusModifySchema;
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });

        if (channel.type !== ChannelType.GUILD_VOICE || !channel.guild_id) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

        if (!(await isConnectedToVoiceChannel(channel_id, req.user_id))) {
            req.permission!.hasThrow("MANAGE_CHANNELS");
        }

        channel.status = body.status;

        await Promise.all([
            channel.save(),
            emitEvent({
                event: "VOICE_CHANNEL_STATUS_UPDATE",
                channel_id,
                data: {
                    id: channel.id,
                    guild_id: channel.guild_id,
                    status: channel.status ?? null,
                },
            } satisfies VoiceChannelStatusUpdateEvent),
        ]);

        return res.sendStatus(204);
    },
);

export default router;

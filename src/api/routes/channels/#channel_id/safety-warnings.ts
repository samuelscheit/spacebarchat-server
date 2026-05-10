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
import { ChannelType, type PublicChannel } from "@spacebar/schemas";
import { ApiError, Channel, type ChannelUpdateEvent, DiscordApiErrors, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const channelIdPattern = /^\d{1,20}$/;
type SafetyWarningsClearedChannel = PublicChannel & { safety_warnings: [] };

function assertValidChannelId(channelId: string) {
    if (!channelIdPattern.test(channelId)) throw unknownChannelError();
}

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function toSafetyWarningsClearedChannel(channel: Pick<Channel, "id" | "type"> & Partial<Pick<Channel, "toJSON">>): SafetyWarningsClearedChannel {
    const channelJson = typeof channel.toJSON === "function" ? channel.toJSON() : { id: channel.id, type: channel.type };
    return {
        ...channelJson,
        safety_warnings: [],
    } as SafetyWarningsClearedChannel;
}

router.delete(
    "/",
    route({
        summary: "Delete Safety Warnings",
        description: "Deletes all safety warnings for a DM channel when safety-warning persistence is available.",
        right: "OPERATOR",
        event: "CHANNEL_UPDATE",
        responses: {
            200: {},
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
        assertValidChannelId(channel_id);

        const channel = await Channel.findOne({
            where: { id: channel_id },
            select: {
                id: true,
                type: true,
            },
        });
        if (!channel) throw unknownChannelError();
        if (channel.type !== ChannelType.DM) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

        // Spacebar does not currently persist DM safety-warning records; emit an
        // empty warning set so clients receive the documented cleared-channel signal.
        await emitEvent({
            event: "CHANNEL_UPDATE",
            channel_id,
            data: toSafetyWarningsClearedChannel(channel),
        } as ChannelUpdateEvent);

        return res.status(200).send();
    },
);

export default router;

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
import { Channel, VoiceState } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { resolveChannelCallEligibility, type CallEligibilityChannel } from "../../../util/handlers/ChannelPrivateCall";

const router: Router = Router({ mergeParams: true });

async function sendCustomCallSound(channel: CallEligibilityChannel, requesterId: string): Promise<void> {
    resolveChannelCallEligibility(channel, requesterId);

    const activeVoiceStates = await VoiceState.count({
        where: { channel_id: channel.id },
    });
    if (!activeVoiceStates) return;

    throw new HTTPError("Custom call sounds are not supported", 501);
}

router.post(
    "/",
    route({
        summary: "Send Custom Call Sound",
        description: "Sends a custom call sound in an active private channel call.",
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
            501: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            relations: { recipients: true },
        });

        await sendCustomCallSound(channel, req.user_id);
        return res.sendStatus(204);
    },
);

export default router;

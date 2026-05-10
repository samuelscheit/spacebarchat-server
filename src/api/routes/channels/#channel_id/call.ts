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
import { Channel, DiscordApiErrors, VoiceState, type Recipient } from "@spacebar/util";
import { ChannelType, type ChannelCallEligibilityResponse, type ChannelCallModifySchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });

type CallEligibilityRecipient = Pick<Recipient, "closed" | "user_id">;
type CallEligibilityChannel = Pick<Channel, "id" | "type"> & {
    recipients?: CallEligibilityRecipient[] | null;
};

function isPrivateCallChannel(channel: CallEligibilityChannel) {
    return channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM;
}

export function resolveChannelCallEligibility(channel: CallEligibilityChannel, requesterId: string): ChannelCallEligibilityResponse {
    if (!isPrivateCallChannel(channel)) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    const recipients = channel.recipients ?? [];
    const requester = recipients.find((recipient) => recipient.user_id === requesterId);
    if (!requester || requester.closed !== false) throw DiscordApiErrors.MISSING_PERMISSIONS;

    return {
        ringable: recipients.some((recipient) => recipient.user_id !== requesterId),
    };
}

async function modifyChannelCall(channel: CallEligibilityChannel, requesterId: string, payload: ChannelCallModifySchema): Promise<void> {
    resolveChannelCallEligibility(channel, requesterId);

    const activeVoiceStates = await VoiceState.count({
        where: { channel_id: channel.id },
    });
    if (!activeVoiceStates) return;

    if (payload.region !== undefined) {
        throw new HTTPError("Call region modification is not supported", 501);
    }
}

router.get(
    "/",
    route({
        summary: "Get Call Eligibility",
        description: "Checks if the current user is eligible to ring a call in the private channel.",
        responses: {
            200: {
                body: "ChannelCallEligibilityResponse",
            },
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
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            relations: { recipients: true },
        });

        return res.json(resolveChannelCallEligibility(channel, req.user_id));
    },
);

router.patch(
    "/",
    route({
        requestBody: "ChannelCallModifySchema",
        coerceRequestBody: false,
        summary: "Modify Call",
        description: "Modifies the active call in the private channel.",
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

        await modifyChannelCall(channel, req.user_id, req.body as ChannelCallModifySchema);
        return res.sendStatus(204);
    },
);

export default router;

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
import { Channel, DiscordApiErrors, VoiceState } from "@spacebar/util";
import { type ChannelCallModifySchema, type ChannelCallRingSchema, type ChannelCallStopRingingSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { resolveChannelCallEligibility, type CallEligibilityChannel } from "../../../util/handlers/ChannelPrivateCall";

const router: Router = Router({ mergeParams: true });

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

function resolveChannelCallRingRecipients(channel: CallEligibilityChannel, requesterId: string, payload: ChannelCallRingSchema): string[] {
    resolveChannelCallEligibility(channel, requesterId);

    const recipients = channel.recipients ?? [];
    const recipientIds = new Set(recipients.map((recipient) => recipient.user_id));
    const requestedRecipients = payload.recipients;

    if (requestedRecipients === undefined || requestedRecipients === null) {
        return recipients.map((recipient) => recipient.user_id).filter((recipientId) => recipientId !== requesterId);
    }

    if (requestedRecipients.some((recipientId) => !recipientIds.has(recipientId))) {
        throw DiscordApiErrors.MISSING_PERMISSIONS;
    }

    return [...new Set(requestedRecipients.filter((recipientId) => recipientId !== requesterId))];
}

async function ringChannelCall(channel: CallEligibilityChannel, requesterId: string, payload: ChannelCallRingSchema): Promise<void> {
    const recipientIds = resolveChannelCallRingRecipients(channel, requesterId, payload);

    const activeVoiceStates = await VoiceState.count({
        where: { channel_id: channel.id },
    });
    if (!activeVoiceStates || recipientIds.length === 0) return;

    throw new HTTPError("Call ringing is not supported", 501);
}

function resolveChannelCallStopRingingRecipients(channel: CallEligibilityChannel, requesterId: string, payload: ChannelCallStopRingingSchema): string[] {
    resolveChannelCallEligibility(channel, requesterId);

    const recipients = channel.recipients ?? [];
    const recipientIds = new Set(recipients.map((recipient) => recipient.user_id));
    const requestedRecipients = payload.recipients;

    if (requestedRecipients === undefined || requestedRecipients === null) {
        return [requesterId];
    }

    if (requestedRecipients.some((recipientId) => !recipientIds.has(recipientId))) {
        throw DiscordApiErrors.MISSING_PERMISSIONS;
    }

    return [...new Set(requestedRecipients)];
}

async function stopRingingChannelCall(channel: CallEligibilityChannel, requesterId: string, payload: ChannelCallStopRingingSchema): Promise<void> {
    const recipientIds = resolveChannelCallStopRingingRecipients(channel, requesterId, payload);

    const activeVoiceStates = await VoiceState.count({
        where: { channel_id: channel.id },
    });
    if (!activeVoiceStates || recipientIds.length === 0) return;

    throw new HTTPError("Call stop-ringing is not supported", 501);
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

router.post(
    "/ring",
    route({
        requestBody: {
            schema: "ChannelCallRingSchema",
            required: false,
        },
        coerceRequestBody: false,
        summary: "Ring Channel Recipients",
        description: "Rings the recipients of a private channel to notify them of an active call.",
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

        await ringChannelCall(channel, req.user_id, (req.body ?? {}) as ChannelCallRingSchema);
        return res.sendStatus(204);
    },
);

router.post(
    "/stop-ringing",
    route({
        requestBody: {
            schema: "ChannelCallStopRingingSchema",
            required: false,
        },
        coerceRequestBody: false,
        summary: "Stop Ringing Channel Recipients",
        description: "Stops ringing the recipients of a private channel.",
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

        await stopRingingChannelCall(channel, req.user_id, (req.body ?? {}) as ChannelCallStopRingingSchema);
        return res.sendStatus(204);
    },
);

export default router;

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
import { ChannelType, type APIIntegrationArray } from "@spacebar/schemas";
import { ApiError, Channel, DiscordApiErrors, type Recipient } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const channelIdPattern = /^\d{1,20}$/;

type ChannelIntegrationRecipient = Pick<Recipient, "closed" | "user_id">;
type ChannelIntegrationChannel = Pick<Channel, "type"> & {
    recipients?: ChannelIntegrationRecipient[] | null;
};

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function assertValidChannelId(channelId: string) {
    if (!channelIdPattern.test(channelId)) throw unknownChannelError();
}

function isPrivateIntegrationChannel(channel: Pick<ChannelIntegrationChannel, "type">) {
    return channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM;
}

export function assertChannelIntegrationAccess(channel: ChannelIntegrationChannel, userId: string): void {
    if (!isPrivateIntegrationChannel(channel)) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    const recipients = channel.recipients ?? [];
    if (!recipients.some((recipient) => recipient.user_id === userId && recipient.closed === false)) throw DiscordApiErrors.MISSING_PERMISSIONS;
}

export function listChannelIntegrations(channel: ChannelIntegrationChannel, userId: string): APIIntegrationArray {
    assertChannelIntegrationAccess(channel, userId);

    // Spacebar does not currently persist private-channel integration records.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Channel Integrations",
        description: "Returns a list of integration objects for the private channel.",
        responses: {
            200: {
                body: "APIIntegrationArray",
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
        assertValidChannelId(channel_id);

        const channel = await Channel.findOne({
            where: { id: channel_id },
            relations: { recipients: true },
        });
        if (!channel) throw unknownChannelError();

        return res.json(listChannelIntegrations(channel, req.user_id));
    },
);

export default router;

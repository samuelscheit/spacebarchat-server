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
import { ApiError, Channel, DiscordApiErrors, DmChannelDTO, type ChannelUpdateEvent, type Recipient, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const channelIdPattern = /^\d{1,20}$/;

type BlockedUserWarningChannel = PublicChannel & {
    blocked_user_warning_dismissed: true;
};

type GroupDmChannel = Channel & {
    recipients?: Pick<Recipient, "closed" | "user_id">[] | null;
};

function assertValidChannelId(channelId: string) {
    if (!channelIdPattern.test(channelId)) throw unknownChannelError();
}

function unknownChannelError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
}

function assertActiveGroupDmRecipient(channel: GroupDmChannel, requesterId: string) {
    if (channel.type !== ChannelType.GROUP_DM) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    const isActiveRecipient = (channel.recipients ?? []).some((recipient) => recipient.user_id === requesterId && recipient.closed === false);
    if (!isActiveRecipient) throw DiscordApiErrors.MISSING_PERMISSIONS;
}

async function toBlockedUserWarningDismissedChannel(channel: GroupDmChannel, requesterId: string): Promise<BlockedUserWarningChannel> {
    const channelDto = await DmChannelDTO.from(channel);

    return {
        ...channelDto.forRecipient(requesterId),
        blocked_user_warning_dismissed: true,
    } as unknown as BlockedUserWarningChannel;
}

router.post(
    "/",
    route({
        summary: "Acknowledge Blocked User Warning",
        description: "Acknowledges that a group DM contains users the current user has blocked.",
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

        const channel = (await Channel.findOneOrFail({
            where: { id: channel_id },
            relations: { recipients: true },
        })) as GroupDmChannel;
        assertActiveGroupDmRecipient(channel, req.user_id);

        await emitEvent({
            event: "CHANNEL_UPDATE",
            user_id: req.user_id,
            data: await toBlockedUserWarningDismissedChannel(channel, req.user_id),
        } satisfies ChannelUpdateEvent);

        return res.status(200).send();
    },
);

export default router;

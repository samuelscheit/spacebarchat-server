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
import { type ChannelRecipientMeUpdateSchema, ChannelType, PublicUserProjection } from "@spacebar/schemas";
import {
    Channel,
    type ChannelDeleteEvent,
    ChannelRecipientAddEvent,
    type ChannelUpdateEvent,
    DiscordApiErrors,
    DmChannelDTO,
    type MessageAckEvent,
    assertCanAddGroupDmRecipient,
    emitEvent,
    Recipient,
    User,
} from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });
const ACCEPTED_MESSAGE_REQUEST_CONSENT_STATUS = 2;

type GroupDmRecipientCarrier = { recipients?: Pick<Recipient, "user_id">[] };
type MessageRequestRecipient = Pick<Recipient, "closed" | "save" | "user_id">;
type MessageRequestChannel = Pick<Channel, "id" | "last_message_id" | "type"> & {
    recipients?: MessageRequestRecipient[] | null;
};

function assertNewGroupDmRecipient(channel: GroupDmRecipientCarrier, user_id: string) {
    if (channel.recipients?.some((recipient) => recipient.user_id === user_id)) {
        throw DiscordApiErrors.INVALID_RECIPIENT;
    }
}

async function loadGroupDmRecipientUser(user_id: string) {
    const user = await User.findOne({
        where: { id: user_id },
        select: PublicUserProjection,
    });
    if (!user) throw DiscordApiErrors.INVALID_RECIPIENT;

    return user;
}

export async function loadAddableGroupDmRecipient(channel: GroupDmRecipientCarrier, user_id: string) {
    assertNewGroupDmRecipient(channel, user_id);
    return await loadGroupDmRecipientUser(user_id);
}

function assertMessageRequestDmChannel(channel: Pick<Channel, "type">) {
    if (channel.type !== ChannelType.DM) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;
}

function getCurrentMessageRequestRecipient(channel: MessageRequestChannel, userId: string): MessageRequestRecipient {
    const recipient = channel.recipients?.find((candidate) => candidate.user_id === userId);
    if (!recipient) throw DiscordApiErrors.MISSING_PERMISSIONS;

    return recipient;
}

export function assertPendingMessageRequestRecipient(channel: MessageRequestChannel, userId: string): MessageRequestRecipient {
    const recipient = getCurrentMessageRequestRecipient(channel, userId);
    if (recipient.closed === false) throw DiscordApiErrors.MISSING_PERMISSIONS;

    return recipient;
}

async function toCurrentUserDmChannel(channel: MessageRequestChannel, userId: string) {
    const channelDto = await DmChannelDTO.from(channel as Channel);
    return channelDto.forRecipient(userId);
}

type CurrentUserDmChannel = Awaited<ReturnType<typeof toCurrentUserDmChannel>>;

async function emitMessageRequestUpdate(data: CurrentUserDmChannel, userId: string) {
    await emitEvent({
        event: "CHANNEL_UPDATE",
        user_id: userId,
        data,
    } as ChannelUpdateEvent);
}

async function emitMessageRequestDelete(data: CurrentUserDmChannel, userId: string) {
    await emitEvent({
        event: "CHANNEL_DELETE",
        user_id: userId,
        data,
    } as ChannelDeleteEvent);
}

async function emitMessageRequestAck(channel: MessageRequestChannel) {
    if (!channel.last_message_id) return;

    await emitEvent({
        event: "MESSAGE_ACK",
        channel_id: channel.id,
        data: {
            channel_id: channel.id,
            message_id: channel.last_message_id,
        },
    } satisfies MessageAckEvent);
}

export async function updateCurrentUserMessageRequest(channel: MessageRequestChannel, userId: string, body: ChannelRecipientMeUpdateSchema) {
    assertMessageRequestDmChannel(channel);
    const recipient = getCurrentMessageRequestRecipient(channel, userId);

    if (body.consent_status !== ACCEPTED_MESSAGE_REQUEST_CONSENT_STATUS) {
        throw DiscordApiErrors.MISSING_PERMISSIONS;
    }

    if (recipient.closed !== false) {
        recipient.closed = false;
        await recipient.save();
    }

    const response = await toCurrentUserDmChannel(channel, userId);
    await emitMessageRequestUpdate(response, userId);
    return response;
}

export async function rejectCurrentUserMessageRequest(channel: MessageRequestChannel, userId: string) {
    assertMessageRequestDmChannel(channel);
    const recipient = assertPendingMessageRequestRecipient(channel, userId);

    if (recipient.closed !== true) {
        recipient.closed = true;
        await recipient.save();
    }

    const response = await toCurrentUserDmChannel(channel, userId);
    await emitMessageRequestUpdate(response, userId);
    await emitMessageRequestAck(channel);
    await emitMessageRequestDelete(response, userId);

    return response;
}

export async function putChannelRecipient(req: Request, res: Response) {
    const { channel_id, user_id } = req.params as { [key: string]: string };
    const channel = await Channel.findOneOrFail({
        where: { id: channel_id },
        relations: { recipients: true },
    });

    if (channel.type !== ChannelType.GROUP_DM) {
        const recipients = [...new Set([...(channel.recipients?.map((r) => r.user_id) || []), user_id])];

        const new_channel = await Channel.createDMChannel(recipients, req.user_id);
        return res.status(201).json(new_channel);
    } else {
        assertNewGroupDmRecipient(channel, user_id);
        assertCanAddGroupDmRecipient(channel.recipients, channel.owner_id);
        const user = await loadGroupDmRecipientUser(user_id);

        channel.recipients?.push(Recipient.create({ channel_id: channel_id, user_id: user_id }));
        await channel.save();

        const channel_dto = await DmChannelDTO.from(channel);
        await emitEvent({
            event: "CHANNEL_CREATE",
            data: channel_dto.forRecipient(user_id),
            user_id: user_id,
        });

        await emitEvent({
            event: "CHANNEL_RECIPIENT_ADD",
            data: {
                channel_id: channel_id,
                user: user.toPublicUser(),
            },
            channel_id: channel_id,
        } satisfies ChannelRecipientAddEvent);
        return res.sendStatus(204);
    }
}

router.delete(
    "/@me",
    route({
        summary: "Reject Message Request",
        event: ["CHANNEL_UPDATE", "MESSAGE_ACK", "CHANNEL_DELETE"],
        responses: {
            200: {
                body: "DmChannelDTO",
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

        return res.status(200).json(await rejectCurrentUserMessageRequest(channel, req.user_id));
    },
);

router.patch(
    "/@me",
    route({
        requestBody: "ChannelRecipientMeUpdateSchema",
        coerceRequestBody: false,
        summary: "Update Message Request",
        event: "CHANNEL_UPDATE",
        responses: {
            200: {
                body: "DmChannelDTO",
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

        return res.status(200).json(await updateCurrentUserMessageRequest(channel, req.user_id, req.body as ChannelRecipientMeUpdateSchema));
    },
);

router.put(
    "/@me",
    route({
        requestBody: "ChannelRecipientMeUpdateSchema",
        coerceRequestBody: false,
        summary: "Update Message Request",
        event: "CHANNEL_UPDATE",
        responses: {
            200: {
                body: "DmChannelDTO",
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

        return res.status(200).json(await updateCurrentUserMessageRequest(channel, req.user_id, req.body as ChannelRecipientMeUpdateSchema));
    },
);

router.put(
    "/:user_id",
    route({
        responses: {
            201: {},
            404: {},
        },
    }),
    putChannelRecipient,
);

router.delete(
    "/:user_id",
    route({
        responses: {
            204: {},
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id, user_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            relations: { recipients: true },
        });
        if (!(channel.type === ChannelType.GROUP_DM && (channel.owner_id === req.user_id || user_id === req.user_id))) throw DiscordApiErrors.MISSING_PERMISSIONS;

        await Channel.removeRecipientFromChannel(channel, user_id);

        return res.sendStatus(204);
    },
);

export default router;

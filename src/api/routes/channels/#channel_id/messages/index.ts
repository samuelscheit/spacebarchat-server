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

import { getMessageHistoryQueryOrder, hydrateInteractionMetadataUsers, route, sortMessagesNewestFirst, toPublicReactions } from "@spacebar/api";
import {
    Channel,
    emitEvent,
    getPermission,
    Message,
    MessageAckEvent,
    messagePublicWithThreadRelations,
    NewUrlUserSignatureData,
    ReadState,
    Snowflake,
    upsertChannelMessageReadState,
    User,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { FindManyOptions, FindOperator, LessThan, MoreThan, MoreThanOrEqual } from "typeorm";
import {
    AcknowledgeDeleteSchema,
    type ChannelMessagesAckPatchSchema,
    type ChannelMessagesAckStateResponse,
    isTextChannel,
    PartialUser,
    ReadStateFlags,
    ReadStateType,
} from "@spacebar/schemas";
import { createMessageRouteHandlers } from "../../../../util/handlers/ChannelMessageCreateRoute";

const router: Router = Router({ mergeParams: true });
const MESSAGE_ACK_VERSION = 3763;
const snowflakePattern = /^[1-9]\d{16,19}$/;

type MutableChannelMessagesAckReadState = Pick<
    ReadState,
    "channel_id" | "last_message_id" | "last_pin_timestamp" | "last_viewed" | "mention_count" | "notifications_cursor" | "read_state_type" | "user_id"
> & {
    flags: ReadStateFlags | 0;
    save(): Promise<unknown>;
};

export interface ChannelMessagesAckDependencies {
    findChannelReadState(user_id: string, channel_id: string): Promise<MutableChannelMessagesAckReadState | null>;
    createChannelReadState(user_id: string, channel_id: string): MutableChannelMessagesAckReadState;
    upsertChannelMessageReadState: typeof upsertChannelMessageReadState;
    emitEvent: typeof emitEvent;
}

const defaultChannelMessagesAckDependencies: ChannelMessagesAckDependencies = {
    findChannelReadState: (user_id, channel_id) =>
        ReadState.findOne({
            where: {
                channel_id,
                user_id,
                read_state_type: ReadStateType.CHANNEL,
            },
        }),
    createChannelReadState: (user_id, channel_id) =>
        ReadState.create({
            channel_id,
            user_id,
            read_state_type: ReadStateType.CHANNEL,
            mention_count: 0,
            last_viewed: 0,
            badge_count: 0,
        }),
    upsertChannelMessageReadState,
    emitEvent,
};

function requireNonNegativeInteger(value: number | undefined, field: string) {
    if (value === undefined) return;
    if (!Number.isSafeInteger(value) || value < 0) throw new HTTPError(`${field} must be a non-negative integer`, 400);
}

function requireSnowflake(value: string | undefined, field: string) {
    if (value === undefined) return;
    if (!snowflakePattern.test(value)) throw new HTTPError(`${field} must be a valid snowflake`, 400);
}

function channelMessagesAckMessageId(body: ChannelMessagesAckPatchSchema) {
    if (body.message_id !== undefined && body.last_message_id !== undefined && body.message_id !== body.last_message_id) {
        throw new HTTPError("message_id and last_message_id must match when both are provided", 400);
    }

    const messageId = body.message_id ?? body.last_message_id;
    requireSnowflake(messageId, "message_id");
    return messageId;
}

function hasLocalReadStatePatchFields(body: ChannelMessagesAckPatchSchema) {
    return body.flags !== undefined || body.last_viewed !== undefined || body.mention_count !== undefined;
}

function serializeLastPinTimestamp(value: Date | string | null | undefined) {
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value.toISOString() : value;
}

export function toChannelMessagesAckStateResponse(channel_id: string, readState: MutableChannelMessagesAckReadState | null): ChannelMessagesAckStateResponse {
    return {
        channel_id,
        read_state_type: readState?.read_state_type ?? ReadStateType.CHANNEL,
        last_message_id: readState?.last_message_id ?? null,
        notifications_cursor: readState?.notifications_cursor ?? null,
        mention_count: readState?.mention_count ?? 0,
        last_pin_timestamp: serializeLastPinTimestamp(readState?.last_pin_timestamp),
        last_viewed: readState?.last_viewed ?? 0,
        flags: readState?.flags ?? 0,
    };
}

export async function getChannelMessagesAckState(user_id: string, channel_id: string, dependencies: ChannelMessagesAckDependencies = defaultChannelMessagesAckDependencies) {
    return toChannelMessagesAckStateResponse(channel_id, await dependencies.findChannelReadState(user_id, channel_id));
}

export async function patchChannelMessagesAckState(
    user_id: string,
    channel_id: string,
    body: ChannelMessagesAckPatchSchema,
    dependencies: ChannelMessagesAckDependencies = defaultChannelMessagesAckDependencies,
) {
    requireNonNegativeInteger(body.mention_count, "mention_count");
    requireNonNegativeInteger(body.last_viewed, "last_viewed");
    requireNonNegativeInteger(body.flags, "flags");

    const message_id = channelMessagesAckMessageId(body);
    if (message_id) {
        await dependencies.upsertChannelMessageReadState({ user_id, channel_id }, message_id, {
            flags: body.flags,
            last_viewed: body.last_viewed,
        });
    }

    if (hasLocalReadStatePatchFields(body)) {
        const readState = (await dependencies.findChannelReadState(user_id, channel_id)) ?? dependencies.createChannelReadState(user_id, channel_id);
        if (body.mention_count !== undefined) readState.mention_count = body.mention_count;
        if (body.last_viewed !== undefined) readState.last_viewed = body.last_viewed;
        if (body.flags !== undefined) readState.flags = body.flags;
        await readState.save();
    }

    if (message_id) {
        await dependencies.emitEvent({
            event: "MESSAGE_ACK",
            channel_id,
            data: {
                channel_id,
                message_id,
                version: MESSAGE_ACK_VERSION,
            },
        } satisfies MessageAckEvent);
    }

    return getChannelMessagesAckState(user_id, channel_id, dependencies);
}

// https://discord.com/developers/docs/resources/channel#create-message
// get messages
router.get(
    "/",
    route({
        query: {
            around: {
                type: "string",
            },
            before: {
                type: "string",
            },
            after: {
                type: "string",
            },
            limit: {
                type: "number",
                description: "max number of messages to return (1-100). defaults to 50",
            },
        },
        responses: {
            200: {
                body: "APIMessageArray",
            },
            400: {
                body: "APIErrorResponse",
            },
            403: {},
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });
        if (!channel) throw new HTTPError("Channel not found", 404);

        isTextChannel(channel.type);
        const around = req.query.around ? `${req.query.around}` : undefined;
        const before = req.query.before ? `${req.query.before}` : undefined;
        const after = req.query.after ? `${req.query.after}` : undefined;
        const limit = Number(req.query.limit) || 50;
        if (limit < 1 || limit > 100) throw new HTTPError("limit must be between 1 and 100", 422);

        const permissions = await getPermission(req.user_id, channel.guild_id, channel_id);
        permissions.hasThrow("VIEW_CHANNEL");
        if (!permissions.has("READ_MESSAGE_HISTORY")) return res.json([]);

        const query: FindManyOptions<Message> & {
            where: { id?: FindOperator<string> | FindOperator<string>[] };
        } = {
            relationLoadStrategy: "query",
            order: getMessageHistoryQueryOrder({}),
            take: limit,
            where: { channel_id },
            relations: messagePublicWithThreadRelations,
        };

        let messages: Message[];

        if (around) {
            query.take = Math.floor(limit / 2);
            if (query.take != 0) {
                const [right, left] = await Promise.all([
                    Message.find({
                        ...query,
                        where: { channel_id, id: LessThan(around) },
                    }),
                    Message.find({
                        ...query,
                        where: { channel_id, id: MoreThanOrEqual(around) },
                        order: getMessageHistoryQueryOrder({ after: around }),
                    }),
                ]);
                left.push(...right);
                messages = sortMessagesNewestFirst(left);
            } else {
                query.take = 1;
                const message = await Message.findOne({
                    ...query,
                    where: { channel_id, id: around },
                });
                messages = message ? [message] : [];
            }
        } else {
            if (after) {
                if (BigInt(after) > BigInt(Snowflake.generate())) throw new HTTPError("after parameter must not be greater than current time", 422);

                query.where.id = MoreThan(after);
                query.order = getMessageHistoryQueryOrder({ after });
            } else if (before) {
                if (BigInt(before) > BigInt(Snowflake.generate())) throw new HTTPError("before parameter must not be greater than current time", 422);

                query.where.id = LessThan(before);
            }

            messages = await Message.find(query);
            if (after) sortMessagesNewestFirst(messages);
        }

        await Message.fillReplies(messages);
        const ret = messages.map((msg) => {
            const x = msg.toJSON();

            x.reactions = toPublicReactions(msg.reactions, req.user_id);
            if (!x.author)
                x.author = {
                    id: "4",
                    discriminator: "0000",
                    username: "Spacebar Ghost",
                    public_flags: 0,
                    avatar: null,
                } as PartialUser;
            /**
			Some clients ( discord.js ) only check if a property exists within the response,
			which causes errors when, say, the `application` property is `null`.
			**/

            // for (var curr in x) {
            // 	if (x[curr] === null)
            // 		delete x[curr];
            // }

            return Message.prototype.withSignedAttachments.call(
                x,
                new NewUrlUserSignatureData({
                    ip: req.ip,
                    userAgent: req.headers["user-agent"] as string,
                }),
            );
        });
        //console.log(ret);

        await hydrateInteractionMetadataUsers(ret, (userId) => User.getPublicUser(userId));

        return res.json(ret);
    },
);

router.post("/", ...createMessageRouteHandlers);

router.get(
    "/ack",
    route({
        permission: "VIEW_CHANNEL",
        summary: "Get Channel Message Acknowledgement",
        description:
            "Returns the current user's locally persisted channel read-state fields for message acknowledgement. When no read state exists, Spacebar returns an empty local read-state representation instead of fabricating Discord ack-token state.",
        responses: {
            200: {
                body: "ChannelMessagesAckStateResponse",
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
        res.json(await getChannelMessagesAckState(req.user_id, channel_id));
    },
);

router.patch(
    "/ack",
    route({
        permission: "VIEW_CHANNEL",
        requestBody: "ChannelMessagesAckPatchSchema",
        summary: "Update Channel Message Acknowledgement",
        description:
            "Updates the current user's locally persisted channel message acknowledgement fields. Discord's exact channel-level ack token contract is not source-documented here, so Spacebar only stores durable read-state fields it owns.",
        responses: {
            200: {
                body: "ChannelMessagesAckStateResponse",
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
        res.json(await patchChannelMessagesAckState(req.user_id, channel_id, req.body as ChannelMessagesAckPatchSchema));
    },
);

router.delete(
    "/ack",
    route({
        requestBody: "AcknowledgeDeleteSchema",
        responses: {
            204: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string }; // not really a channel id if read_state_type != CHANNEL
        const body = req.body as AcknowledgeDeleteSchema;
        if (body.version != 2) return res.status(204).send();
        const read_state_type = body.read_state_type ?? ReadStateType.CHANNEL;

        const readState = await ReadState.findOne({ where: { channel_id, user_id: req.user_id, read_state_type } });
        if (readState) {
            await readState.remove();
        }

        res.status(204).send();
    },
);

export default router;

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

import { assertMessagePayloadPermissions, createMessageUpload, handleMessage, messageToResponse, postHandleMessage, route } from "@spacebar/api";
import {
    Attachment,
    Channel,
    Config,
    DiscordApiErrors,
    DmChannelDTO,
    emitEvent,
    FieldErrors,
    getAttachmentFilename,
    getUploadInputForMultipartFile,
    getPermission,
    Member,
    Message,
    MessageAttachmentUploadInput,
    MessageCreateEvent,
    normalizeMessageAttachmentInputs,
    Relationship,
    Rights,
    serializeThreadMemberPayload,
    Snowflake,
    ThreadCreateEvent,
    ThreadMember,
    ThreadMemberFlags,
    ThreadMembersUpdateEvent,
    uploadFile,
    upsertChannelMessageReadState,
} from "@spacebar/util";
import { MessageCreateCloudAttachment, MessageCreateSchema, normalizeMessageCreateSchema, RelationshipType } from "@spacebar/schemas";
import { Request, Response, type RequestHandler } from "express";
import { HTTPError } from "lambert-server";
import { MoreThan } from "typeorm";

export const messageUpload = createMessageUpload();

export const createMessageUploadHandler = messageUpload.any();

export const normalizeMessageCreateRequestBody: RequestHandler = (req, res, next) => {
    if (req.body.payload_json) {
        req.body = JSON.parse(req.body.payload_json);
    }

    normalizeMessageCreateSchema(req.body);
    next();
};

export const createMessageBodyRoute = route({
    requestBody: "MessageCreateSchema",
    stripNulls: {
        components: true,
        embeds: true,
    },
    right: "SEND_MESSAGES",
    responses: {
        200: {
            body: "APIPublicMessage",
        },
        400: {
            body: "APIErrorResponse",
        },
        403: {},
        404: {},
    },
});

export const createMessagePermissionRoute = route({
    permission: "VIEW_CHANNEL",
    responses: {
        403: {},
        404: {},
    },
});

export const loadMessageChannelPermissions: RequestHandler = async (req, _res, next) => {
    const { guild_id, channel_id } = req.params as { [key: string]: string };
    req.permission = await getPermission(req.user_id, guild_id, channel_id);
    next();
};

export const createMessageHandler: RequestHandler = async (req: Request, res: Response) => {
    const { channel_id } = req.params as { [key: string]: string };
    const body = req.body as MessageCreateSchema;
    const messageId = Snowflake.generate();
    const attachmentInputs = normalizeMessageAttachmentInputs(body.attachments, body.files);
    const uploadedAttachments = new Map<MessageAttachmentUploadInput, Attachment>();
    const consumedUploadInputs = new Set<MessageAttachmentUploadInput>();
    const unmatchedUploadedAttachments: Attachment[] = [];

    const channel = await Channel.findOneOrFail({
        where: { id: channel_id },
        relations: { recipients: { user: true } },
    });
    if (channel.thread_metadata?.locked) throw DiscordApiErrors.THREAD_IS_LOCKED;

    const files = (req.files as Express.Multer.File[]) ?? [];
    const attachments = attachmentInputs.map((input) => input.metadata);
    assertMessagePayloadPermissions(req.permission!, { ...body, attachments, uploadedFileCount: files.length });

    if (channel.isThread()) {
        req.permission!.hasThrow("SEND_MESSAGES_IN_THREADS");
        if (channel.recipients && !channel.recipients.find(({ id }) => id === req.user_id)) {
            const member = await Member.findOneOrFail({ where: { id: req.user_id, guild_id: channel.guild_id! } });

            if (!(await ThreadMember.existsBy({ member_idx: member.index, id: channel_id }))) {
                const threadMember = ThreadMember.create({
                    member_idx: member.index,
                    id: channel_id,
                    join_timestamp: new Date(),
                    muted: false,
                    flags: ThreadMemberFlags.ALL_MESSAGES,
                });
                await threadMember.save();

                // increment member count
                if (channel.member_count !== null && channel.member_count !== undefined) {
                    channel.member_count++;
                    await channel.save();
                }

                await emitEvent({
                    event: "THREAD_MEMBERS_UPDATE",
                    data: {
                        guild_id: channel.guild_id!,
                        id: channel.id,
                        member_count: channel.member_count ?? 0, // TODO: is this the right fix?
                        added_members: [serializeThreadMemberPayload(threadMember, req.user_id)],
                    },
                    channel_id: channel.id,
                } satisfies ThreadMembersUpdateEvent);

                await emitEvent({
                    event: "THREAD_CREATE",
                    data: { ...channel.toJSON(), newly_created: false },
                    user_id: req.user_id,
                } satisfies ThreadCreateEvent);
            }
        }
    } else {
        req.permission!.hasThrow("SEND_MESSAGES");
    }
    if (!channel.isWritable()) {
        throw new HTTPError(`Cannot send messages to channel of type ${channel.type}`, 400);
    }

    // Handle blocked users in DMs, and prevent direct channel-id sends from reopening a closed
    // one-to-one DM after the recipient restricted server DMs.
    if (channel.recipients?.length == 2) {
        const otherUser = channel.recipients.find((r) => r.user_id != req.user_id)?.user;
        if (otherUser) {
            const relationship = await Relationship.findOne({
                where: [
                    { from_id: req.user_id, to_id: otherUser.id },
                    { from_id: otherUser.id, to_id: req.user_id },
                ],
            });

            if (relationship?.type === RelationshipType.blocked) {
                throw DiscordApiErrors.CANNOT_MESSAGE_USER;
            }
        }
    }
    await Channel.checkServerDmReopenPrivacy(channel, req.user_id);

    if (body.nonce) {
        const existing = await Message.findOne({
            where: {
                nonce: body.nonce,
                channel_id: channel.id,
                author_id: req.user_id,
            },
        });
        if (existing) {
            return res.json(existing);
        }
    }

    if (!req.rights.has(Rights.FLAGS.BYPASS_RATE_LIMITS)) {
        const limits = Config.get().limits;
        if (limits.absoluteRate.sendMessage.enabled) {
            const count = await Message.count({
                where: {
                    channel_id,
                    timestamp: MoreThan(new Date(Date.now() - limits.absoluteRate.sendMessage.window)),
                },
            });

            if (count >= limits.absoluteRate.sendMessage.limit)
                throw FieldErrors({
                    channel_id: {
                        code: "TOO_MANY_MESSAGES",
                        message: req.t("common:toomany.MESSAGE"),
                    },
                });
        }
    }

    for (const currFile of files) {
        try {
            const uploadInput = getUploadInputForMultipartFile(currFile, attachmentInputs, consumedUploadInputs);
            const originalname = getAttachmentFilename(uploadInput?.metadata) ?? currFile.originalname;
            const file = await uploadFile(`/attachments/${channel.id}/${messageId}`, { ...currFile, originalname });
            const attachment = Attachment.create(file);

            if (uploadInput) {
                consumedUploadInputs.add(uploadInput);
                uploadedAttachments.set(uploadInput, attachment);
            } else {
                unmatchedUploadedAttachments.push(attachment);
            }
        } catch (error) {
            return res.status(400).json({ message: error?.toString() });
        }
    }

    const messageAttachments: (Attachment | MessageCreateCloudAttachment)[] = [];
    for (const input of attachmentInputs) {
        if (input.type === "cloud") {
            messageAttachments.push(input.metadata);
            continue;
        }

        const uploadedAttachment = uploadedAttachments.get(input);
        if (uploadedAttachment) messageAttachments.push(uploadedAttachment);
    }
    messageAttachments.push(...unmatchedUploadedAttachments);

    const message = await handleMessage({
        ...body,
        id: messageId,
        type: 0,
        pinned: false,
        author_id: req.user_id,
        embeds: body.embeds || [],
        channel_id,
        attachments: messageAttachments,
        attachment_user_id: req.user_id,
        attachment_channel_ids: [channel.id],
        timestamp: new Date(),
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore dont care2
    message.edited_timestamp = null;

    if (channel.isDm()) {
        const channel_dto = await DmChannelDTO.from(channel);

        // Only one recipients should be closed here, since in group DMs the recipient is deleted not closed
        await Promise.all(
            channel.recipients
                ?.map((recipient) => {
                    if (recipient.closed) {
                        recipient.closed = false;
                        return Promise.all([
                            recipient.save(),
                            emitEvent({
                                event: "CHANNEL_CREATE",
                                data: channel_dto.forRecipient(recipient.user_id),
                                user_id: recipient.user_id,
                            }),
                        ]);
                    }
                    return null;
                })
                .filter((x) => x !== null) || [],
        );
    }

    if (channel.isThread()) {
        channel.message_count = (channel.message_count || 0) + 1;
        channel.total_message_sent = (channel.total_message_sent || 0) + 1;
        channel.last_message_id = message.id;
        await Promise.all([
            channel.save(),
            emitEvent({
                event: "CHANNEL_UPDATE",
                data: { ...channel.toJSON(), newly_created: false },
                guild_id: channel.guild_id,
            }),
        ]);
    }

    if (message.guild_id) {
        // handleMessage will fetch the Member, but only if they are not guild owner.
        // have to fetch ourselves otherwise.
        if (!message.member) {
            message.member = await Member.findOneOrFail({
                where: { id: req.user_id, guild_id: message.guild_id },
                relations: { roles: true },
            });
            message.member.clean_data();
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        message.member.roles = message.member.roles.filter((x) => x.id != x.guild_id).map((x) => x.id);
    }

    await Promise.all([
        upsertChannelMessageReadState({ user_id: req.user_id, channel_id }, message.id),
        message.save(),
        emitEvent({
            event: "MESSAGE_CREATE",
            channel_id: channel_id,
            data: message.toJSON(),
        } satisfies MessageCreateEvent),
        message.guild_id ? Member.update({ id: req.user_id, guild_id: message.guild_id }, { last_message_id: message.id }) : undefined,
    ]);

    // no await as it shouldnt block the message send function and silently catch error
    postHandleMessage(message).catch((e) => console.error("[Message] post-message handler failed", e));
    return res.json(messageToResponse(message, req));
};

export const createMessageBodyRouteHandlers: RequestHandler[] = [createMessageUploadHandler, normalizeMessageCreateRequestBody, createMessageBodyRoute];
export const createMessageChannelRouteHandlers: RequestHandler[] = [createMessagePermissionRoute, createMessageHandler];
export const createMessageResolvedChannelRouteHandlers: RequestHandler[] = [loadMessageChannelPermissions, createMessageHandler];
export const createMessageRouteHandlers: RequestHandler[] = [...createMessageBodyRouteHandlers, ...createMessageChannelRouteHandlers];

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

import { InteractionCallbacksSchema, InteractionCallbackType, MessageType } from "@spacebar/schemas";
import {
    assertMessagePayloadPermissions,
    createApplicationCommandInteractionMessageData,
    handleMessage,
    normalizeMessageEditBodyAttachments,
    postHandleMessage,
    route,
    sendMessage,
} from "@spacebar/api";
import { Request, Response, Router } from "express";
import { acknowledgeDeferredMessageUpdateInteraction } from "../../../../util/handlers/InteractionCallbackState";
import {
    buildMessageEditComponentProcessingOptions,
    buildMessageEditHandleMessageOptions,
    emitEvent,
    getPermission,
    InteractionSuccessEvent,
    Message,
    MessageUpdateEvent,
    pendingInteractions,
    requirePendingInteractionForCallback,
    User,
    messagePublicWithThreadRelations,
} from "@spacebar/util";
import { HTTPError } from "#util/util/lambert-server";
import { assertMessagePayloadLimits } from "../../../../util/utility/MessagePayloadLimits";

const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        stripNulls: true,
        requestBody: "InteractionCallbacksSchema",
    }),
    async (req: Request, res: Response) => {
        const body = req.body as InteractionCallbacksSchema;

        const interactionId = req.params.interaction_id as string;
        const interactionToken = req.params.interaction_token as string | undefined;
        const interaction = requirePendingInteractionForCallback(interactionId, interactionToken);

        if (
            body.type === InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE ||
            body.type === InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE ||
            body.type === InteractionCallbackType.UPDATE_MESSAGE ||
            body.type === InteractionCallbackType.DEFERRED_UPDATE_MESSAGE
        ) {
            assertMessagePayloadLimits(body.data);
            if (!interaction.channelId) throw new HTTPError("Interaction channel not found", 400);
            const permissions = await getPermission(interaction.applicationId, interaction.guildId, interaction.channelId);
            assertMessagePayloadPermissions(permissions, body.data);
        }

        if (body.type === InteractionCallbackType.DEFERRED_UPDATE_MESSAGE) {
            await acknowledgeDeferredMessageUpdateInteraction(interactionId, interaction, pendingInteractions, emitEvent);
            res.sendStatus(204);
            return;
        }

        clearTimeout(interaction.timeout);

        await emitEvent({
            event: "INTERACTION_SUCCESS",
            user_id: interaction?.userId,
            data: {
                id: interactionId,
                nonce: interaction.nonce,
            },
        } satisfies InteractionSuccessEvent);

        switch (body.type) {
            case InteractionCallbackType.PONG:
                // PONG acknowledges ping interactions without creating or updating messages.
                break;
            case InteractionCallbackType.ACKNOWLEDGE:
                // Deprected
                break;
            case InteractionCallbackType.CHANNEL_MESSAGE:
                // TODO
                break;
            case InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE: {
                const user = await User.findOneOrFail({ where: { id: interaction.userId } });
                const interactionUser = user.toPublicUser();
                /*
			const files = (req.files as Express.Multer.File[]) ?? [];
			//I don't think traditional attachments are allowed anyways
			const attachments: (Attachment | MessageCreateAttachmentMetadata)[] = [];
			for (const currFile of files) {
				try {
					const file = await uploadFile(`/attachments/${interaction.channelId}`, currFile);
					attachments.push(Attachment.create(file));
				} catch (error) {
					return res.status(400).json({ message: error?.toString() });
				}
			}
			*/
                await sendMessage({
                    type: MessageType.APPLICATION_COMMAND,
                    timestamp: new Date(),
                    application_id: interaction.applicationId,
                    channel_id: interaction.channelId,
                    author_id: interaction.applicationId,
                    nonce: interaction.nonce,
                    content: body.data.content,
                    components: body.data.components || [],
                    tts: body.data.tts,
                    embeds: body.data.embeds || [],
                    attachments: body.data.attachments,
                    poll: body.data.poll,
                    flags: body.data.flags,
                    reactions: [],
                    // webhook_id: interaction.applicationId, // This one requires a webhook to be created first
                    ...createApplicationCommandInteractionMessageData({
                        commandName: interaction.commandName,
                        commandType: interaction.commandType,
                        interactionId,
                        userId: interaction.userId,
                        user: interactionUser,
                    }),
                });

                break;
            }
            case InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE:
                // TODO
                break;
            case InteractionCallbackType.UPDATE_MESSAGE:
                {
                    if (!interaction.messageId) throw new HTTPError("no. That was not a message");
                    const channelId = interaction.channelId;
                    if (!channelId) throw new HTTPError("Interaction channel not found", 400);
                    const message = await Message.findOneOrFail({
                        relations: {
                            ...messagePublicWithThreadRelations,
                            attachments: true,
                            channel: true,
                        },
                        where: {
                            id: interaction.messageId,
                            channel_id: channelId,
                        },
                    });
                    const normalizedBody = normalizeMessageEditBodyAttachments(body.data, message.attachments);
                    const componentProcessingOptions = buildMessageEditComponentProcessingOptions(normalizedBody);
                    const updatedMessage = await handleMessage(
                        buildMessageEditHandleMessageOptions(message, normalizedBody, channelId, message.id, new Date(), {
                            attachment_user_id: interaction.applicationId,
                            attachment_channel_ids: [channelId],
                            is_edit: true,
                            ...componentProcessingOptions,
                        }),
                        { suppress_notifications: true },
                    );
                    await updatedMessage.save();
                    await emitEvent({
                        event: "MESSAGE_UPDATE",
                        channel_id: channelId,
                        data: {
                            ...updatedMessage.toJSON(),
                            nonce: undefined,
                        },
                    } satisfies MessageUpdateEvent);
                    postHandleMessage(updatedMessage).catch((e) => console.error("[InteractionCallback] post-message handler failed", e));
                }
                break;
            /*
            case InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT:
                // TODO
                break;
            case InteractionCallbackType.MODAL:
                // TODO
                break;
            case InteractionCallbackType.PREMIUM_REQUIRED:
                // Deprecated
                break;
            case InteractionCallbackType.IFRAME_MODAL:
                break;
            case InteractionCallbackType.LAUNCH_ACTIVITY:
                // Unsupported until InteractionCallbacksSchema and embedded activity launch state exist.
                break;
            */
            default:
                body satisfies never;
        }

        pendingInteractions.delete(interactionId);
        res.sendStatus(204);
    },
);

export default router;

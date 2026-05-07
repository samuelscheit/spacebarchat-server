import { buildMessageEditHandleMessageOptions, emitEvent, getPermission, getRights, Message, MessageUpdateEvent } from "@spacebar/util";
import { handleMessage, postHandleMessage } from "@spacebar/api";
import type { Request, Response } from "express";
import type { MessageEditSchema } from "@spacebar/schemas";

export async function patchMessage(req: Request, res: Response) {
    const { message_id, channel_id } = req.params as { [key: string]: string };
    let body = req.body as MessageEditSchema;

    const message = await Message.findOneOrFail({
        where: { id: message_id, channel_id },
        relations: { attachments: true },
    });

    const permissions = await getPermission(req.user_id, undefined, channel_id);

    const rights = await getRights(req.user_id);

    if (req.user_id !== message.author_id) {
        if (!rights.has("MANAGE_MESSAGES")) {
            permissions.hasThrow("MANAGE_MESSAGES");
            body = { flags: body.flags };
            // guild admins can only suppress embeds of other messages, no such restriction imposed to instance-wide admins
        }
    } else rights.hasThrow("SELF_EDIT_MESSAGES");

    const new_message = await handleMessage(buildMessageEditHandleMessageOptions(message, body, channel_id, message_id));

    await new_message.save();
    await emitEvent({
        event: "MESSAGE_UPDATE",
        channel_id,
        data: {
            ...new_message.toJSON(),
            nonce: undefined,
        },
    } satisfies MessageUpdateEvent);

    postHandleMessage(new_message).catch((e) => console.error("[Message] post-message handler failed", e));

    // TODO: a DTO?
    return res.json({
        ...new_message.toJSON(),
        id: new_message.id,
        type: new_message.type,
        channel_id: new_message.channel_id,
        member: new_message.member?.toPublicMember(),
        author: new_message.author?.toPublicUser(),
        attachments: new_message.attachments,
        embeds: new_message.embeds,
        mentions: new_message.embeds,
        mention_roles: new_message.mention_roles,
        mention_everyone: new_message.mention_everyone,
        pinned: new_message.pinned,
        timestamp: new_message.timestamp,
        edited_timestamp: new_message.edited_timestamp,

        // these are not in the Discord.com response
        mention_channels: new_message.mention_channels,
    });
}

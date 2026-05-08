import { assertMessagePayloadPermissions, handleMessage, messageToResponse, postHandleMessage } from "@spacebar/api";
import {
    Attachment,
    Channel,
    Config,
    DiscordApiErrors,
    emitEvent,
    FieldErrors,
    getPermission,
    handleFile,
    Message,
    MessageCreateEvent,
    Rights,
    Snowflake,
    toAPIWebhook,
    ValidateWebhookName,
    Webhook,
    getRights,
} from "@spacebar/util";
import { Request, Response } from "express";
import { HTTPError } from "lambert-server";
import { MoreThan } from "typeorm";
import { WebhookExecuteSchema, WebhookTokenUpdateSchema } from "@spacebar/schemas";
import { mergeWebhookMessageAttachments } from "./WebhookAttachments";
import { getWebhookForToken, uploadWebhookMessageFiles } from "./WebhookMessage";
import { buildWebhooksUpdateEvent } from "../utility/WebhookEvents";

async function webhookCanBypassSendMessageRateLimit(webhook: Webhook) {
    const userId = webhook.user_id ?? webhook.application?.bot?.id;
    if (!userId) return false;

    const rights = await getRights(userId);
    return rights.has(Rights.FLAGS.BYPASS_RATE_LIMITS);
}

export async function updateWebhookWithToken(req: Request, res: Response) {
    const { webhook_id, token } = req.params as { [key: string]: string };
    const body = req.body as WebhookTokenUpdateSchema;

    const webhook = await getWebhookForToken(webhook_id, token, { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true });

    if (!body.name && !body.avatar) {
        throw new HTTPError("Empty webhook updates are not allowed", 50006);
    }

    const update: Partial<Pick<Webhook, "name" | "avatar">> = {};
    if (body.avatar) update.avatar = (await handleFile(`/avatars/${webhook_id}`, body.avatar)) as string;

    if (body.name !== undefined) {
        update.name = ValidateWebhookName(body.name);
    }

    webhook.assign(update);

    const webhooksUpdateEvent = buildWebhooksUpdateEvent(webhook);

    await webhook.save();
    if (webhooksUpdateEvent) await emitEvent(webhooksUpdateEvent);

    res.json(
        toAPIWebhook(webhook, {
            url: Config.get().api.endpointPublic + "/webhooks/" + webhook.id + "/" + webhook.token,
        }),
    );
}

type ExecuteWebhookOptions = {
    wait?: boolean;
};

export const executeWebhook = (req: Request, res: Response) => executeWebhookWithOptions(req, res);

export const executeWebhookWithOptions = async (req: Request, res: Response, options: ExecuteWebhookOptions = {}) => {
    const body = req.body as WebhookExecuteSchema;
    const messageId = Snowflake.generate();

    const { webhook_id, token } = req.params as { [key: string]: string };

    const webhook = await getWebhookForToken(webhook_id, token, { channel: true, guild: true, application: { bot: true } });

    if (body.username) {
        body.username = ValidateWebhookName(body.username);
    }

    // ensure one of content, embeds, components, or file is present
    if (!body.content && !body.embeds && !body.components && !body.file && !body.attachments) {
        throw DiscordApiErrors.CANNOT_SEND_EMPTY_MESSAGE;
    }

    const wait = options.wait ?? req.query.wait === "true";
    const thread_id = typeof req.query.thread_id === "string" ? req.query.thread_id : undefined;
    const acknowledgeNoWait = () => {
        if (!wait && !res.headersSent) {
            res.status(204).send();
        }
    };

    const attachments: Attachment[] = [];

    if (!webhook.channel.isWritable()) {
        if (wait) {
            throw new HTTPError(`Cannot send messages to channel of type ${webhook.channel.type}`, 400);
        } else {
            acknowledgeNoWait();
            return;
        }
    }

    const limits = Config.get().limits;
    if (limits.absoluteRate.sendMessage.enabled && !(await webhookCanBypassSendMessageRateLimit(webhook))) {
        const count = await Message.count({
            where: {
                channel_id: webhook.channel_id,
                timestamp: MoreThan(new Date(Date.now() - limits.absoluteRate.sendMessage.window)),
            },
        });

        if (count >= limits.absoluteRate.sendMessage.limit)
            if (wait) {
                throw FieldErrors({
                    channel_id: {
                        code: "TOO_MANY_MESSAGES",
                        message: req.t("common:toomany.MESSAGE"),
                    },
                });
            } else {
                acknowledgeNoWait();
                return;
            }
    }

    let sendChannel = webhook.channel;
    if (thread_id) {
        sendChannel = await Channel.findOneOrFail({
            where: {
                id: thread_id,
                parent_id: webhook.channel.id,
            },
        });
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    const permissionSubjectId = webhook.user_id ?? webhook.application_id;
    const messagePayload = { ...body, attachments: body.attachments ?? [], uploadedFileCount: files.length };
    if (permissionSubjectId) {
        const permissions = await getPermission(permissionSubjectId, sendChannel.guild_id, sendChannel);
        assertMessagePayloadPermissions(permissions, messagePayload);
    } else {
        assertMessagePayloadPermissions(
            {
                hasThrow(permission) {
                    throw new HTTPError(`Webhook cannot send media requiring ${permission} without a permission subject`, 403);
                },
            },
            messagePayload,
        );
    }

    acknowledgeNoWait();

    try {
        attachments.push(...(await uploadWebhookMessageFiles(sendChannel.id, messageId, files)));
    } catch (error) {
        if (wait) res.status(400).json({ message: error?.toString() });
        return;
    }

    const embeds = body.embeds || [];
    const bodyMsg = {
        ...body,
        allowed_mentions: body.allowed_mentions
            ? {
                  ...body.allowed_mentions,
                  parse: body.allowed_mentions.parse as ("users" | "roles" | "everyone")[],
              }
            : undefined,
    } as Parameters<typeof handleMessage>[0];
    const message = await handleMessage({
        id: messageId,
        ...bodyMsg,
        username: body.username || webhook.name,
        avatar_url: body.avatar_url || webhook.avatar,
        type: 0,
        pinned: false,
        webhook_id: webhook.id,
        application_id: webhook.application?.id,
        embeds,
        // TODO: Support thread_id/thread_name once threads are implemented
        channel_id: sendChannel.id,
        attachments: mergeWebhookMessageAttachments(attachments, body.attachments),
        timestamp: new Date(),
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore dont care2
    message.edited_timestamp = null;

    sendChannel.last_message_id = message.id;

    await Promise.all([
        message.save(),
        sendChannel.save(),
        emitEvent({
            event: "MESSAGE_CREATE",
            channel_id: sendChannel.id,
            data: message.toJSON(),
        } satisfies MessageCreateEvent),
    ]);

    // no await as it shouldnt block the message send function and silently catch error
    postHandleMessage(message).catch((e) => console.error("[Message] post-message handler failed", e));
    if (wait) res.json(messageToResponse(message, req));
    return;
};

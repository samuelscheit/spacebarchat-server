import { assertMessagePayloadPermissions, handleMessage, messageToResponse, postHandleMessage } from "@spacebar/api";
import {
    Attachment,
    Channel,
    Config,
    ChannelFlags,
    DiscordApiErrors,
    emitEvent,
    FieldErrors,
    getPermission,
    handleFile,
    Message,
    MessageCreateEvent,
    Snowflake,
    toAPIWebhook,
    ValidateWebhookName,
    Webhook,
} from "@spacebar/util";
import { Request, Response } from "express";
import { HTTPError } from "lambert-server";
import { MoreThan } from "typeorm";
import { ChannelType, WebhookExecuteSchema, WebhookTokenUpdateSchema } from "@spacebar/schemas";
import { mergeWebhookMessageAttachments } from "./WebhookAttachments";
import { getWebhookForToken, uploadWebhookMessageFiles } from "./WebhookMessage";
import { buildWebhooksUpdateEvent } from "../utility/WebhookEvents";

type WebhookPermissionChecker = Awaited<ReturnType<typeof getPermission>>;

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

function assertWebhookThreadRequest(body: WebhookExecuteSchema, thread_id?: string) {
    if (thread_id && body.thread_name) {
        throw FieldErrors({
            thread_name: {
                message: "thread_name cannot be used with thread_id",
            },
        });
    }
}

function assertWebhookThreadTags(channel: Channel, body: WebhookExecuteSchema, permissions: WebhookPermissionChecker) {
    const appliedTags = body.applied_tags ?? [];

    if (!appliedTags.length) {
        if (channel.flags & Number(ChannelFlags.FLAGS.REQUIRE_TAG)) {
            throw FieldErrors({
                applied_tags: {
                    code: "BASE_TYPE_REQUIRED",
                    message: "Tag is required for this channel",
                },
            });
        }
        return;
    }

    const availableTags = new Map((channel.available_tags ?? []).map((tag) => [tag.id, tag]));
    const badTag = appliedTags.find((tag) => !availableTags.has(tag));
    if (badTag) {
        throw FieldErrors({
            applied_tags: {
                message: `Invalid tag ${badTag}`,
            },
        });
    }

    if (appliedTags.some((tag) => availableTags.get(tag)?.moderated)) {
        permissions.hasThrow("MANAGE_THREADS");
    }
}

async function resolveWebhookSendChannel(webhook: Webhook, body: WebhookExecuteSchema, thread_id?: string, permissions?: WebhookPermissionChecker): Promise<Channel> {
    if (thread_id) {
        return Channel.findOneOrFail({
            where: {
                id: thread_id,
                parent_id: webhook.channel.id,
            },
        });
    }

    if (!body.thread_name) return webhook.channel;

    if (!permissions) {
        throw new HTTPError("Webhook cannot create a thread without a permission subject", 403);
    }

    if (!webhook.channel.threadOnly()) {
        throw FieldErrors({
            thread_name: {
                message: "thread_name can only be used in forum or media channels",
            },
        });
    }

    assertWebhookThreadTags(webhook.channel, body, permissions);
    permissions.hasThrow("CREATE_PUBLIC_THREADS");

    const threadOwnerId = webhook.user_id ?? webhook.application_id;

    return Channel.createThreadChannel(
        {
            owner: webhook.user,
            parent: webhook.channel,
            guild: webhook.guild,
            name: body.thread_name,
            parent_id: webhook.channel.id,
            guild_id: webhook.channel.guild_id,
            type: webhook.channel.type === ChannelType.GUILD_NEWS ? ChannelType.GUILD_NEWS_THREAD : ChannelType.GUILD_PUBLIC_THREAD,
            applied_tags: body.applied_tags || [],
            recipients: [],
        },
        {
            archived: false,
            auto_archive_duration: webhook.channel.default_auto_archive_duration || 4320,
            archive_timestamp: new Date().toISOString(),
            locked: false,
            create_timestamp: new Date().toISOString(),
        },
        threadOwnerId,
    );
}

export const executeWebhook = async (req: Request, res: Response) => {
    const body = req.body as WebhookExecuteSchema;
    const messageId = Snowflake.generate();

    const { webhook_id, token } = req.params as { [key: string]: string };

    const wait = req.query.wait === "true";
    const thread_id = typeof req.query.thread_id === "string" ? req.query.thread_id : undefined;
    assertWebhookThreadRequest(body, thread_id);

    const webhook = await getWebhookForToken(webhook_id, token, { user: true, channel: { available_tags: true }, guild: true, application: true });

    if (body.username) {
        body.username = ValidateWebhookName(body.username);
    }

    // ensure one of content, embeds, components, or file is present
    if (!body.content && !body.embeds && !body.components && !body.file && !body.attachments) {
        throw DiscordApiErrors.CANNOT_SEND_EMPTY_MESSAGE;
    }

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

    // TODO: creating messages by users checks if the user can bypass rate limits, we cant do that on webhooks, but maybe we could check the application if there is one?
    const limits = Config.get().limits;
    if (limits.absoluteRate.sendMessage.enabled) {
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

    const files = (req.files as Express.Multer.File[]) ?? [];
    const permissionSubjectId = webhook.user_id ?? webhook.application_id;
    const messagePayload = { ...body, attachments: body.attachments ?? [], uploadedFileCount: files.length };
    let sendChannel = webhook.channel;
    if (permissionSubjectId) {
        const permissions = await getPermission(permissionSubjectId, webhook.channel.guild_id, webhook.channel);
        assertMessagePayloadPermissions(permissions, messagePayload);
        sendChannel = await resolveWebhookSendChannel(webhook, body, thread_id, permissions);
        if (sendChannel.id !== webhook.channel.id) {
            const sendChannelPermissions = await getPermission(permissionSubjectId, sendChannel.guild_id, sendChannel);
            sendChannelPermissions.hasThrow("SEND_MESSAGES_IN_THREADS");
            assertMessagePayloadPermissions(sendChannelPermissions, messagePayload);
        }
    } else {
        assertMessagePayloadPermissions(
            {
                hasThrow(permission) {
                    throw new HTTPError(`Webhook cannot send media requiring ${permission} without a permission subject`, 403);
                },
            },
            messagePayload,
        );
        sendChannel = await resolveWebhookSendChannel(webhook, body, thread_id);
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

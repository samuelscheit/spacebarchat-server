import { route } from "@spacebar/api";
import {
    Config,
    DiscordApiErrors,
    getPermission,
    Webhook,
    emitEvent,
    Channel,
    handleFile,
    ValidateWebhookName,
    Message,
    MessageDeleteBulkEvent,
    toAPIWebhook,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { isTextChannel, WebhookUpdateSchema } from "@spacebar/schemas";
import { In } from "typeorm";
import { buildWebhooksUpdateEvent } from "../../../util/utility/WebhookEvents";
const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        description: "Returns a webhook object for the given id. Requires the MANAGE_WEBHOOKS permission or to be the owner of the webhook.",
        responses: {
            200: {
                body: "WebhookCreateResponse",
            },
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { webhook_id } = req.params as { [key: string]: string };
        const webhook = await Webhook.findOneOrFail({
            where: { id: webhook_id },
            relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
        });

        if (webhook.guild_id) {
            const permission = await getPermission(req.user_id, webhook.guild_id);

            if (!permission.has("MANAGE_WEBHOOKS")) throw DiscordApiErrors.UNKNOWN_WEBHOOK;
        } else if (webhook.user_id != req.user_id) throw DiscordApiErrors.UNKNOWN_WEBHOOK;

        return res.json(
            toAPIWebhook(webhook, {
                url: Config.get().api.endpointPublic + "/webhooks/" + webhook.id + "/" + webhook.token,
            }),
        );
    },
);

router.delete(
    "/",
    route({
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { webhook_id } = req.params as { [key: string]: string };

        const webhook = await Webhook.findOneOrFail({
            where: { id: webhook_id },
            relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
        });

        if (webhook.guild_id) {
            const permission = await getPermission(req.user_id, webhook.guild_id);

            if (!permission.has("MANAGE_WEBHOOKS")) throw DiscordApiErrors.UNKNOWN_WEBHOOK;
        } else if (webhook.user_id != req.user_id) throw DiscordApiErrors.UNKNOWN_WEBHOOK;

        const channel_id = webhook.channel_id;
        const channel = await Channel.findOneOrFail({ where: { id: channel_id } });

        // work around foreign key constraint
        while (await Message.count({ where: { webhook_id, channel_id } })) {
            const ids = (await Message.find({ where: { webhook_id, channel_id }, select: { id: true }, order: { id: "asc" }, take: 100 })).map((x) => x.id);
            await Message.delete({ id: In(ids) });
            await emitEvent({
                event: "MESSAGE_DELETE_BULK",
                channel_id,
                origin: "webhook delete",
                data: {
                    channel_id,
                    guild_id: channel.guild_id,
                    ids,
                },
            } satisfies MessageDeleteBulkEvent);
        }

        await Webhook.delete({ id: webhook_id });

        const webhooksUpdateEvent = buildWebhooksUpdateEvent(webhook);
        if (webhooksUpdateEvent) await emitEvent(webhooksUpdateEvent);

        res.sendStatus(204);
    },
);

router.patch(
    "/",
    route({
        requestBody: "WebhookUpdateSchema",
        responses: {
            200: {
                body: "WebhookCreateResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            403: {},
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { webhook_id } = req.params as { [key: string]: string };
        const body = req.body as WebhookUpdateSchema;

        const webhook = await Webhook.findOneOrFail({
            where: { id: webhook_id },
            relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
        });

        if (webhook.guild_id) {
            const permission = await getPermission(req.user_id, webhook.guild_id);

            if (!permission.has("MANAGE_WEBHOOKS")) throw DiscordApiErrors.UNKNOWN_WEBHOOK;
        } else if (webhook.user_id != req.user_id) throw DiscordApiErrors.UNKNOWN_WEBHOOK;

        if (!body.name && !body.avatar && !body.channel_id) {
            throw new HTTPError("Empty webhook updates are not allowed", 50006);
        }

        if (body.avatar) body.avatar = await handleFile(`/avatars/${webhook_id}`, body.avatar as string);

        if (body.name !== undefined) {
            body.name = ValidateWebhookName(body.name);
        }

        const previousWebhookLocation = {
            channel_id: webhook.channel_id,
            guild_id: webhook.guild_id ?? webhook.channel?.guild_id,
        };
        const channel_id = body.channel_id || webhook.channel_id;
        webhook.assign(body);

        let movedWebhookLocation = previousWebhookLocation;
        if (body.channel_id && body.channel_id !== previousWebhookLocation.channel_id) {
            const targetChannel = await Channel.findOneOrFail({
                where: { id: channel_id },
            });
            isTextChannel(targetChannel.type);

            if (!targetChannel.guild_id || targetChannel.guild_id !== previousWebhookLocation.guild_id) {
                throw new HTTPError("Webhooks can only be moved within the same guild", 400);
            }

            const targetPermission = await getPermission(req.user_id, undefined, targetChannel);
            if (!targetPermission.has("MANAGE_WEBHOOKS")) throw DiscordApiErrors.UNKNOWN_WEBHOOK;

            movedWebhookLocation = {
                channel_id: targetChannel.id,
                guild_id: targetChannel.guild_id,
            };
            webhook.assign({
                channel: targetChannel,
            });
        }

        await webhook.save();

        const webhooksUpdateEvents = [
            buildWebhooksUpdateEvent(previousWebhookLocation),
            movedWebhookLocation.channel_id !== previousWebhookLocation.channel_id ? buildWebhooksUpdateEvent(movedWebhookLocation) : undefined,
        ].filter((event): event is NonNullable<typeof event> => !!event);

        await Promise.all(webhooksUpdateEvents.map((event) => emitEvent(event)));

        res.json(
            toAPIWebhook(webhook, {
                url: Config.get().api.endpointPublic + "/webhooks/" + webhook.id + "/" + webhook.token,
            }),
        );
    },
);

export default router;

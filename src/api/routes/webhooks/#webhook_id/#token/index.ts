import { route } from "@spacebar/api";
import { Config, DiscordApiErrors, emitEvent, isValidWebhookToken, Webhook, toAPIWebhook } from "@spacebar/util";
import { Request, Response, Router } from "express";
import multer from "multer";
import { executeWebhook, updateWebhookWithToken } from "../../../../util/handlers/Webhook";
import { buildWebhooksUpdateEvent } from "../../../../util/utility/WebhookEvents";
const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        description: "Returns a webhook object for the given id and token.",
        responses: {
            200: {
                body: "WebhookCreateResponse",
            },
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { webhook_id, token } = req.params as { [key: string]: string };
        const webhook = await Webhook.findOne({
            where: {
                id: webhook_id,
            },
            relations: { user: true, channel: true, source_channel: true, guild: true, source_guild: true, application: true },
        });

        if (!webhook) {
            throw DiscordApiErrors.UNKNOWN_WEBHOOK;
        }

        if (!isValidWebhookToken(webhook.token, token)) {
            throw DiscordApiErrors.INVALID_WEBHOOK_TOKEN_PROVIDED;
        }

        return res.json(
            toAPIWebhook(webhook, {
                url: Config.get().api.endpointPublic + "/webhooks/" + webhook.id + "/" + webhook.token,
            }),
        );
    },
);

// TODO: config max upload size
const messageUpload = multer({
    limits: {
        fileSize: Config.get().limits.message.maxAttachmentSize,
        fields: 10,
        // files: 1
    },
    storage: multer.memoryStorage(),
}); // max upload 50 mb

// https://discord.com/developers/docs/resources/webhook#execute-webhook
// TODO: Slack compatible hooks
router.post(
    "/",
    messageUpload.any(),
    (req, _res, next) => {
        if (req.body.payload_json) {
            req.body = JSON.parse(req.body.payload_json);
        }
        next();
    },
    route({
        requestBody: "WebhookExecuteSchema",
        stripNulls: {
            components: true,
            embeds: true,
        },
        query: {
            wait: {
                type: "boolean",
                required: false,
                description: "waits for server confirmation of message send before response, and returns the created message body",
            },
            thread_id: {
                type: "string",
                required: false,
                description: "Send a message to the specified thread within a webhook's channel.",
            },
        },
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
        },
    }),
    executeWebhook,
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
        const { webhook_id, token } = req.params as { [key: string]: string };

        const webhook = await Webhook.findOne({
            where: {
                id: webhook_id,
            },
            relations: { channel: true, guild: true, application: true },
        });

        if (!webhook) {
            throw DiscordApiErrors.UNKNOWN_WEBHOOK;
        }

        if (!isValidWebhookToken(webhook.token, token)) {
            throw DiscordApiErrors.INVALID_WEBHOOK_TOKEN_PROVIDED;
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
        requestBody: "WebhookTokenUpdateSchema",
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
    updateWebhookWithToken,
);

export default router;

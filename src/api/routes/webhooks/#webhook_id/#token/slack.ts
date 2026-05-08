import { route } from "@spacebar/api";
import { Embed, EmbedType, WebhookExecuteSchema } from "@spacebar/schemas";
import { NextFunction, Request, Response, Router, urlencoded } from "express";
import { executeWebhook } from "../../../../util/handlers/Webhook";

const router = Router({ mergeParams: true });

type SlackField = {
    title?: unknown;
    value?: unknown;
    short?: unknown;
};

type SlackAttachment = {
    fallback?: unknown;
    color?: unknown;
    pretext?: unknown;
    author_name?: unknown;
    author_link?: unknown;
    author_icon?: unknown;
    title?: unknown;
    title_link?: unknown;
    text?: unknown;
    fields?: SlackField[];
    image_url?: unknown;
    thumb_url?: unknown;
    footer?: unknown;
    footer_icon?: unknown;
    ts?: unknown;
};

type SlackWebhookPayload = {
    text?: unknown;
    username?: unknown;
    icon_url?: unknown;
    attachments?: SlackAttachment[];
};

function stringValue(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseSlackColor(color: unknown) {
    if (typeof color !== "string") return undefined;
    if (color === "good") return 0x2eb67d;
    if (color === "warning") return 0xecb22e;
    if (color === "danger") return 0xe01e5a;

    const hex = color.startsWith("#") ? color.slice(1) : color;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;

    return Number.parseInt(hex, 16);
}

function parseSlackTimestamp(value: unknown) {
    if (typeof value !== "string" && typeof value !== "number") return undefined;

    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return undefined;

    return new Date(seconds * 1000).toISOString();
}

function slackAttachmentToEmbed(attachment: SlackAttachment): Embed | undefined {
    const title = stringValue(attachment.title);
    const text = stringValue(attachment.text) ?? stringValue(attachment.fallback);
    const pretext = stringValue(attachment.pretext);
    const description = [pretext, text].filter(Boolean).join("\n\n") || undefined;
    const color = parseSlackColor(attachment.color);
    const timestamp = parseSlackTimestamp(attachment.ts);

    const embed: Embed = {
        type: EmbedType.rich,
    };
    if (title) embed.title = title;

    const titleLink = stringValue(attachment.title_link);
    if (titleLink) embed.url = titleLink;
    if (description) embed.description = description;
    if (color !== undefined) embed.color = color;
    if (timestamp) embed.timestamp = timestamp as unknown as Date;

    const authorName = stringValue(attachment.author_name);
    const authorUrl = stringValue(attachment.author_link);
    const authorIconUrl = stringValue(attachment.author_icon);
    if (authorName || authorUrl || authorIconUrl) {
        embed.author = {};
        if (authorName) embed.author.name = authorName;
        if (authorUrl) embed.author.url = authorUrl;
        if (authorIconUrl) embed.author.icon_url = authorIconUrl;
    }

    const imageUrl = stringValue(attachment.image_url);
    if (imageUrl) embed.image = { url: imageUrl };

    const thumbnailUrl = stringValue(attachment.thumb_url);
    if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };

    const footerText = stringValue(attachment.footer);
    const footerIconUrl = stringValue(attachment.footer_icon);
    if (footerText) {
        embed.footer = {
            text: footerText,
        };
        if (footerIconUrl) embed.footer.icon_url = footerIconUrl;
    }

    if (Array.isArray(attachment.fields)) {
        const fields = attachment.fields
            .map((field) => {
                const name = stringValue(field.title);
                const value = stringValue(field.value);
                if (!name || !value) return undefined;

                return {
                    name,
                    value,
                    inline: field.short === true,
                };
            })
            .filter((field): field is { name: string; value: string; inline: boolean } => !!field);

        if (fields.length) embed.fields = fields;
    }

    const hasContent = embed.title || embed.description || embed.author || embed.image || embed.thumbnail || embed.footer || embed.fields?.length;
    return hasContent ? embed : undefined;
}

function normalizeSlackWebhookBody(req: Request, _res: Response, next: NextFunction) {
    if (typeof req.body?.payload === "string") {
        req.body = JSON.parse(req.body.payload);
    }

    const slackPayload = (req.body ?? {}) as SlackWebhookPayload;
    const discordPayload: WebhookExecuteSchema = {};

    const content = stringValue(slackPayload.text);
    if (content) discordPayload.content = content;

    const username = stringValue(slackPayload.username);
    if (username) discordPayload.username = username;

    const avatarUrl = stringValue(slackPayload.icon_url);
    if (avatarUrl) discordPayload.avatar_url = avatarUrl;

    if (Array.isArray(slackPayload.attachments)) {
        const embeds = slackPayload.attachments.map(slackAttachmentToEmbed).filter((embed): embed is Embed => !!embed);
        if (embeds.length) discordPayload.embeds = embeds;
    }

    req.body = discordPayload;
    if (req.query.wait === undefined) {
        Object.defineProperty(req, "query", {
            value: { ...req.query, wait: "true" },
            configurable: true,
        });
    }

    next();
}

router.post(
    "/",
    urlencoded({ extended: false }),
    normalizeSlackWebhookBody,
    route({
        requestBody: "WebhookExecuteSchema",
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
            200: {
                body: "APIPublicMessage",
            },
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
        },
    }),
    executeWebhook,
);

export default router;

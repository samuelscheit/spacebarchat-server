import type { FindOptionsRelations } from "typeorm";
import type { Message } from "../entities/Message";

export const messagePublicRelations = {
    author: true,
    webhook: true,
    application: true,
    mentions: true,
    mention_roles: true,
    mention_channels: true,
    sticker_items: true,
    attachments: true,
} satisfies FindOptionsRelations<Message>;

export const messagePublicWithThreadRelations = {
    ...messagePublicRelations,
    thread: {
        recipients: {
            user: true,
        },
    },
} satisfies FindOptionsRelations<Message>;

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

import { Snowflake } from "../Identifiers";
import { InteractionType, AllowedMentions, MessageReference, ApplicationCommandType, BaseMessageComponents, Embed, PollAnswer, PollMedia, PublicUser } from "@spacebar/schemas";

export interface MessageCreateAttachment {
    id: string;
    filename?: string;
    name?: string;
    file?: string;
}

export interface MessageCreateCloudAttachment {
    id?: string;
    filename: string;
    uploaded_filename: string;
    original_content_type?: string;
}

export type MessageCreateAttachmentMetadata = MessageCreateAttachment | MessageCreateCloudAttachment;

export interface MessageCreateFile {
    id?: string;
    file?: string;
    name?: string;
    filename?: string;
}

export interface MessageCreateSchema {
    content?: string;
    mobile_network_type?: string;
    nonce?: string;
    channel_id?: string;
    tts?: boolean;
    flags?: number;
    embeds?: Embed[] | null;
    allowed_mentions?: AllowedMentions | null;
    message_reference?: MessageReference | null;
    payload_json?: string;
    file?: { filename: string };
    files?: MessageCreateFile[];
    attachments?: MessageCreateAttachmentMetadata[];
    sticker_ids?: string[] | null; // null check: fixes Discord-Go
    components?: BaseMessageComponents[] | null; // null check: fixes Discord-Go
    // TODO: Fix TypeScript errors in src\api\util\handlers\Message.ts once this is enabled
    poll?: PollCreationSchema;
    enforce_nonce?: boolean; // For Discord compatibility, it's the default behavior here
    applied_tags?: string[]; // Not implemented yet, for webhooks in forums
    thread_name?: string; // Not implemented yet, for webhooks
    avatar_url?: string; // Not implemented yet, for webhooks
    interaction?: MessageInteractionSchema;
    interaction_metadata?: MessageInteractionSchema;
}

// TypeScript complains once this is used above
export interface PollCreationSchema {
    question: PollMedia;
    answers: PollAnswer[];
    duration?: number;
    allow_multiselect?: boolean;
    layout_type?: number;
}

interface MessageInteractionSchema {
    id: string;
    type: InteractionType;
    name: string;
    command_type?: ApplicationCommandType;
    ephemerality_reason?: number;
    user?: PublicUser; // It has to be optional cause LSP gives an errors for some reason
    user_id?: string;
    authorizing_integration_owners?: object; // It has to be optional cause LSP gives an errors for some reason
    original_response_message_id?: Snowflake;
    interacted_message_id?: Snowflake;
    triggering_interaction_metadata?: MessageInteractionSchema;
    target_user?: PublicUser;
    target_message_id?: Snowflake;
}

export type LegacyMessageCreateBody = Omit<MessageCreateSchema, "embeds"> & {
    embeds?: unknown;
    embed?: unknown;
    type?: number;
};

export function normalizeMessageCreateSchema(body: LegacyMessageCreateBody): LegacyMessageCreateBody;
export function normalizeMessageCreateSchema(body: unknown): unknown;
export function normalizeMessageCreateSchema(body: unknown): unknown {
    if (!body || typeof body !== "object") return body;

    const messageBody = body as LegacyMessageCreateBody;
    if (messageBody.embed != null) {
        if (Array.isArray(messageBody.embeds)) messageBody.embeds = [...messageBody.embeds, messageBody.embed];
        else if (messageBody.embeds == null) messageBody.embeds = [messageBody.embed];
    }

    delete messageBody.embed;
    delete messageBody.type;
    return body;
}

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

import type { PartialUser, PublicMessage, PublicUser, StoredReaction } from "@spacebar/schemas";
import { serializePublicMember, type PublicMemberLike } from "./MemberRoles";
import { serializeMessageMentions } from "./MessageMentions";
import { serializeMessageRoleMentions, type SerializableRoleMention } from "./MessageRoleMentions";
import { toPublicReactions } from "./Reactions";

type MessageInteractionMetadata = NonNullable<PublicMessage["interaction_metadata"]>;

type PublicUserLike = Partial<PublicUser> & {
    toPublicUser?: () => unknown;
};

type MessageInteractionMetadataSource = Omit<MessageInteractionMetadata, "triggering_interaction_metadata" | "target_user" | "user"> & {
    target_user?: unknown;
    triggering_interaction_metadata?: unknown;
    user?: unknown;
};

const publicUserKeys = [
    "id",
    "username",
    "discriminator",
    "public_flags",
    "avatar",
    "accent_color",
    "banner",
    "bio",
    "bot",
    "premium_since",
    "premium_type",
    "theme_colors",
    "pronouns",
    "badge_ids",
    "avatar_decoration_data",
    "display_name_styles",
    "collectibles",
    "primary_guild",
] satisfies (keyof PublicUser)[];

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function serializePublicUserLike(user: unknown): PublicUser | undefined {
    if (!isRecord(user)) return undefined;

    const source = typeof (user as PublicUserLike).toPublicUser === "function" ? (user as PublicUserLike).toPublicUser!() : user;
    if (!isRecord(source)) return undefined;

    for (const requiredKey of ["id", "username", "discriminator", "public_flags", "bio", "bot", "premium_type"] satisfies (keyof PublicUser)[]) {
        if (source[requiredKey] === undefined) return undefined;
    }

    return Object.fromEntries(publicUserKeys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])) as PublicUser;
}

function serializeInteractionMetadata(metadata: PublicMessageSource["interaction_metadata"]): PublicMessage["interaction_metadata"] {
    if (!metadata) return undefined;

    const source = metadata as MessageInteractionMetadataSource;
    for (const requiredKey of ["id", "type", "user_id", "authorizing_integration_owners", "name", "command_type"] satisfies (keyof MessageInteractionMetadataSource)[]) {
        if (source[requiredKey] === undefined) return undefined;
    }

    const serialized: MessageInteractionMetadata = {
        id: source.id,
        type: source.type,
        user_id: source.user_id,
        authorizing_integration_owners: source.authorizing_integration_owners,
        name: source.name,
        command_type: source.command_type,
    };
    if (source.ephemerality_reason !== undefined) serialized.ephemerality_reason = source.ephemerality_reason;
    const user = serializePublicUserLike(source.user);
    if (user) serialized.user = user;
    if (source.original_response_message_id !== undefined) serialized.original_response_message_id = source.original_response_message_id;
    if (source.interacted_message_id !== undefined) serialized.interacted_message_id = source.interacted_message_id;
    const triggeringInteractionMetadata = serializeInteractionMetadata(source.triggering_interaction_metadata as PublicMessageSource["interaction_metadata"]);
    if (triggeringInteractionMetadata) serialized.triggering_interaction_metadata = triggeringInteractionMetadata;
    const targetUser = serializePublicUserLike(source.target_user);
    if (targetUser) serialized.target_user = targetUser;
    if (source.target_message_id !== undefined) serialized.target_message_id = source.target_message_id;

    return serialized;
}

interface PublicUserSource {
    avatar?: string | null;
    toPublicUser?: () => unknown;
    username?: string | null;
}

interface PublicMessageSource {
    activity?: PublicMessage["activity"];
    application_id?: string | null;
    attachments?: { toJSON: () => unknown }[];
    author?: PublicUserSource;
    avatar?: string | null;
    channel?: { id: string };
    channel_id?: string | null;
    components?: PublicMessage["components"];
    content?: string | null;
    edited_timestamp?: Date | null;
    embeds?: PublicMessage["embeds"];
    flags: number;
    id: string;
    member?: PublicMemberLike | null;
    mention_channels?: { toJSON: () => unknown }[];
    mention_everyone?: boolean | null;
    mention_roles?: SerializableRoleMention[];
    mentions?: object[] | null;
    message_reference?: PublicMessage["message_reference"];
    interaction_metadata?: PublicMessage["interaction_metadata"];
    message_snapshots?: PublicMessage["message_snapshots"];
    nonce?: string | null;
    pinned: boolean;
    poll?: PublicMessage["poll"];
    reactions?: StoredReaction[];
    referenced_message?: { toJSON: (shallow?: boolean) => PublicMessage } | null;
    thread?: { toJSON: () => PublicMessage["thread"] } | PublicMessage["thread"];
    timestamp: Date;
    tts?: boolean | null;
    type: number;
    username?: string | null;
    webhook_id?: string | null;
}

export function messageToPublicMessage(message: PublicMessageSource, shallow = false): PublicMessage {
    const author = {
        ...(message.author?.toPublicUser?.() ?? undefined),
        // Webhooks
        username: message.username ?? message.author?.username ?? null,
        avatar: message.avatar ?? message.author?.avatar ?? null,
    } as PartialUser;

    return {
        id: message.id,
        channel_id: message.channel_id ?? message.channel!.id,

        timestamp: message.timestamp.toISOString(),
        edited_timestamp: message.edited_timestamp ? message.edited_timestamp.toISOString() : null,

        webhook_id: message.webhook_id ?? undefined,
        application_id: message.application_id ?? undefined,
        member: serializePublicMember(message.member) as PublicMessage["member"],
        mentions: serializeMessageMentions(message.mentions) as PartialUser[],

        mention_roles: serializeMessageRoleMentions(message.mention_roles),
        mention_channels: (message.mention_channels?.map((ch) => ch.toJSON()) ?? []) as NonNullable<PublicMessage["mention_channels"]>,
        attachments: (message.attachments?.map((att) => att.toJSON()) ?? []) as PublicMessage["attachments"],

        nonce: message.nonce ?? undefined,
        tts: message.tts ?? false,
        reactions: message.reactions ? toPublicReactions(message.reactions) : undefined,
        message_reference: message.message_reference ?? undefined,
        mention_everyone: message.mention_everyone ?? false,
        author,
        content: message.content ?? "",
        embeds: message.embeds ?? [],
        flags: message.flags,
        pinned: message.pinned,
        type: message.type,
        activity: message.activity ?? undefined,
        components: message.components ?? [],
        message_snapshots: message.message_snapshots ?? undefined,
        interaction_metadata: serializeInteractionMetadata(message.interaction_metadata),
        poll: message.poll ?? undefined,
        thread: message.thread && "toJSON" in message.thread ? message.thread.toJSON() : message.thread,
        referenced_message: message.referenced_message && !shallow ? message.referenced_message.toJSON(true) : undefined,
    };
}

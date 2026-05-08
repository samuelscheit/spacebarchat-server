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

import type { PartialPublicChannel, PartialUser, PublicMessage, StoredReaction } from "@spacebar/schemas";
import { serializePublicMember, type PublicMemberLike } from "./MemberRoles";
import { serializeMessageMentions } from "./MessageMentions";
import { serializeMessageRoleMentions, type SerializableRoleMention } from "./MessageRoleMentions";
import { toPublicReactions } from "./Reactions";

interface PublicUserSource {
    avatar?: string | null;
    toPublicUser?: () => unknown;
    username?: string | null;
}

interface PublicMentionChannelSource {
    id: string;
    guild_id?: string | null;
    type: PartialPublicChannel["type"];
    name?: string | null;
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
    mention_channels?: PublicMentionChannelSource[];
    mention_everyone?: boolean | null;
    mention_roles?: SerializableRoleMention[];
    mentions?: object[] | null;
    message_reference?: PublicMessage["message_reference"];
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

function toPartialPublicChannel(channel: PublicMentionChannelSource): PartialPublicChannel {
    return {
        id: channel.id,
        guild_id: channel.guild_id ?? undefined,
        type: channel.type,
        name: channel.name ?? undefined,
    };
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
        application_id: undefined,
        member: serializePublicMember(message.member) as PublicMessage["member"],
        mentions: serializeMessageMentions(message.mentions) as PartialUser[],

        mention_roles: serializeMessageRoleMentions(message.mention_roles),
        mention_channels: message.mention_channels?.map(toPartialPublicChannel) ?? [],
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
        poll: message.poll ?? undefined,
        thread: message.thread && "toJSON" in message.thread ? message.thread.toJSON() : message.thread,
        referenced_message: message.referenced_message && !shallow ? message.referenced_message.toJSON(true) : undefined,
    };
}

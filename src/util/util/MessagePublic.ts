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

import type { IntegrationApplication, PartialUser, PublicMessage, StoredReaction } from "@spacebar/schemas";
import { serializePublicMember, type PublicMemberLike } from "./MemberRoles";
import { serializeMessageMentions } from "./MessageMentions";
import { serializeMessageRoleMentions, type SerializableRoleMention } from "./MessageRoleMentions";
import { toPublicReactions } from "./Reactions";

interface PublicUserSource {
    avatar?: string | null;
    toPublicUser?: () => unknown;
    username?: string | null;
}

interface PublicMessageSource {
    activity?: PublicMessage["activity"];
    application?: PublicMessageApplicationSource | null;
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

type PublicMessageApplicationSource = Partial<IntegrationApplication> & {
    id?: string | null;
    name?: string | null;
    description?: string | null;
};

export function serializeMessageApplication(application: PublicMessageApplicationSource | null | undefined): IntegrationApplication | undefined {
    if (!application?.id || !application.name) return undefined;

    const publicApplication: IntegrationApplication = {
        id: application.id,
        name: application.name,
        description: application.description ?? "",
    };

    if ("icon" in application) {
        publicApplication.icon = application.icon ?? null;
    }
    if (application.cover_image != null) {
        publicApplication.cover_image = application.cover_image;
    }
    if (typeof application.flags === "number") {
        publicApplication.flags = application.flags;
    }

    return publicApplication;
}

export function messageToPublicMessage(message: PublicMessageSource, shallow = false): PublicMessage {
    const author = {
        ...(message.author?.toPublicUser?.() ?? undefined),
        // Webhooks
        username: message.username ?? message.author?.username ?? null,
        avatar: message.avatar ?? message.author?.avatar ?? null,
    } as PartialUser;

    const publicMessage: PublicMessage = {
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
        poll: message.poll ?? undefined,
        thread: message.thread && "toJSON" in message.thread ? message.thread.toJSON() : message.thread,
        referenced_message: message.referenced_message && !shallow ? message.referenced_message.toJSON(true) : undefined,
    };

    const application = serializeMessageApplication(message.application);
    if (application) {
        publicMessage.application = application;
    }

    return publicMessage;
}

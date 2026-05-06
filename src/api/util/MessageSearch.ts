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

import type { GuildMessagesSearchMessage, PublicAttachment, PublicUser } from "@spacebar/schemas";
import type { Attachment, Message, User } from "@spacebar/util";

function toPublicUser(user: User): PublicUser {
    return user.toPublicUser?.() ?? (user as unknown as PublicUser);
}

function toPublicAttachment(attachment: Attachment): PublicAttachment {
    const publicAttachment = attachment.toJSON();

    return {
        id: publicAttachment.id,
        filename: publicAttachment.filename,
        size: publicAttachment.size,
        ...(publicAttachment.height != null ? { height: publicAttachment.height } : {}),
        ...(publicAttachment.width != null ? { width: publicAttachment.width } : {}),
        ...(publicAttachment.content_type != null ? { content_type: publicAttachment.content_type } : {}),
        url: publicAttachment.url,
        proxy_url: publicAttachment.proxy_url,
    };
}

export function toGuildMessagesSearchMessage(message: Message): GuildMessagesSearchMessage {
    return {
        id: message.id,
        type: message.type,
        content: message.content ?? "",
        channel_id: message.channel_id ?? message.channel.id,
        author: toPublicUser(message.author!),
        attachments: message.attachments?.map(toPublicAttachment) ?? [],
        embeds: message.embeds ?? [],
        mentions: message.mentions?.map(toPublicUser) ?? [],
        mention_roles: message.mention_roles?.map((role) => role.id) ?? [],
        pinned: message.pinned,
        mention_everyone: message.mention_everyone ?? false,
        tts: message.tts ?? false,
        timestamp: message.timestamp.toISOString(),
        edited_timestamp: message.edited_timestamp ? message.edited_timestamp.toISOString() : null,
        flags: message.flags,
        components: message.components ?? undefined,
        poll: message.poll ?? undefined,
        hit: true,
    };
}

export function toGuildMessagesSearchResult(message: Message): GuildMessagesSearchMessage[] {
    return [toGuildMessagesSearchMessage(message)];
}

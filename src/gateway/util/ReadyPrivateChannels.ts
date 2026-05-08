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

import { ChannelType } from "../../schemas/api/channels/Channel";
import type { PublicUser } from "../../schemas/api/users/User";
import { excludeDmChannelRecipient } from "../../util/dtos/DmChannelRecipients";

type ReadyPrivateChannelRecipient = {
    user: {
        id: string;
        toPublicUser(): PublicUser;
    };
};

type ReadyPrivateChannelSource = {
    id: string;
    flags: number;
    last_message_id?: string;
    type: ChannelType.DM | ChannelType.GROUP_DM;
    recipients: ReadyPrivateChannelRecipient[];
    icon?: string | null;
    name?: string | null;
    owner_id?: string | null;
};

export type ReadyPrivateChannel = {
    id: string;
    flags: number;
    last_message_id?: string;
    type: ChannelType.DM | ChannelType.GROUP_DM;
    recipients: PublicUser[];
    icon?: string | null;
    name?: string | null;
    is_spam: false;
    owner_id?: string;
};

export function toReadyPrivateChannel(channel: ReadyPrivateChannelSource, currentUser: { id: string; toPublicUser(): PublicUser }, users: Set<PublicUser>): ReadyPrivateChannel {
    const channelUsers = excludeDmChannelRecipient(
        channel.recipients.map((recipient) => recipient.user.toPublicUser()),
        currentUser.id,
    );

    if (channelUsers.length === 0 && channel.type === ChannelType.DM) {
        // One-recipient DM channels are valid for note-to-self DMs and can also exist
        // after the other user's recipient row was removed by user deletion. READY still
        // needs a non-empty recipients array so clients can render the private channel.
        channelUsers.push(currentUser.toPublicUser());
    }

    for (const channelUser of channelUsers) users.add(channelUser);

    return {
        id: channel.id,
        flags: channel.flags,
        last_message_id: channel.last_message_id,
        type: channel.type,
        recipients: channelUsers,
        icon: channel.icon,
        name: channel.name,
        is_spam: false,
        owner_id: channel.owner_id || undefined,
    };
}

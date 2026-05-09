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

import { ChannelType, type PublicChannel } from "../../schemas/api/channels/Channel";
import type { Recipient } from "../entities/Recipient";
import { toPartialUsers } from "./PartialUser";

export interface ChannelRecipientSource {
    type: ChannelType;
    recipients?: Recipient[];
}

export function isDmChannelType(type: ChannelType) {
    return type === ChannelType.DM || type === ChannelType.GROUP_DM;
}

export function serializeChannelRecipients(channel: ChannelRecipientSource): PublicChannel["recipients"] {
    if (!isDmChannelType(channel.type)) return undefined;
    if (!channel.recipients) return undefined;
    if (channel.recipients.some((recipient) => !recipient.user)) return undefined;

    return toPartialUsers(channel.recipients.map((recipient) => recipient.user));
}

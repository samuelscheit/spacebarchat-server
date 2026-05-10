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

import { DiscordApiErrors, type Channel, type Recipient } from "@spacebar/util";
import { ChannelType, type ChannelCallEligibilityResponse } from "@spacebar/schemas";

type CallEligibilityRecipient = Pick<Recipient, "closed" | "user_id">;
export type CallEligibilityChannel = Pick<Channel, "id" | "type"> & {
    recipients?: CallEligibilityRecipient[] | null;
};

function isPrivateCallChannel(channel: CallEligibilityChannel) {
    return channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM;
}

export function resolveChannelCallEligibility(channel: CallEligibilityChannel, requesterId: string): ChannelCallEligibilityResponse {
    if (!isPrivateCallChannel(channel)) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    const recipients = channel.recipients ?? [];
    const requester = recipients.find((recipient) => recipient.user_id === requesterId);
    if (!requester || requester.closed !== false) throw DiscordApiErrors.MISSING_PERMISSIONS;

    return {
        ringable: recipients.some((recipient) => recipient.user_id !== requesterId),
    };
}

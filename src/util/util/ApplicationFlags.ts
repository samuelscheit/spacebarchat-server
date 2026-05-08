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

import { BitField, BitFlag } from "./BitField";

export class ApplicationFlags extends BitField {
    static FLAGS = {
        EMBEDDED_RELEASED: BitFlag(1),
        MANAGED_EMOJI: BitFlag(2),
        EMBEDDED_IAP: BitFlag(3),
        GROUP_DM_CREATE: BitFlag(4),
        APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE: BitFlag(6),
        RPC_HAS_CONNECTED: BitFlag(11),
        GATEWAY_PRESENCE: BitFlag(12),
        GATEWAY_PRESENCE_LIMITED: BitFlag(13),
        GATEWAY_GUILD_MEMBERS: BitFlag(14),
        GATEWAY_GUILD_MEMBERS_LIMITED: BitFlag(15),
        VERIFICATION_PENDING_GUILD_LIMIT: BitFlag(16),
        EMBEDDED: BitFlag(17),
        GATEWAY_MESSAGE_CONTENT: BitFlag(18),
        GATEWAY_MESSAGE_CONTENT_LIMITED: BitFlag(19),
        EMBEDDED_FIRST_PARTY: BitFlag(20),
        APPLICATION_COMMAND_BADGE: BitFlag(23),
    };
}

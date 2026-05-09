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

import { Intents } from "@spacebar/util";
import type { PrivilegedIntentsConfiguration } from "../../util/config/types/GatewayConfiguration";

export const DEFAULT_IDENTIFY_INTENTS = Intents.DEFAULT_GATEWAY_IDENTIFY_INTENTS;

export const APPLICATION_FLAG_GATEWAY_PRESENCE = 1 << 12;
export const APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED = 1 << 13;
export const APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS = 1 << 14;
export const APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;
export const APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT = 1 << 18;
export const APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19;

const DEFAULT_CONFIGURED_PRIVILEGED_INTENTS = BigInt(0);

const REQUIRED_APPLICATION_FLAGS_BY_PRIVILEGED_INTENT = [
    {
        intent: Intents.FLAGS.GUILD_PRESENCES,
        flags: APPLICATION_FLAG_GATEWAY_PRESENCE | APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED,
    },
    {
        intent: Intents.FLAGS.GUILD_MEMBERS,
        flags: APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS | APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED,
    },
    {
        intent: Intents.FLAGS.GUILD_MESSAGES_CONTENT,
        flags: APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT | APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED,
    },
];

export function getConfiguredPrivilegedIntents(configValue: PrivilegedIntentsConfiguration | undefined): Intents {
    if (configValue == null) return new Intents(DEFAULT_CONFIGURED_PRIVILEGED_INTENTS);

    return new Intents(configValue);
}

export function getRequestedIdentifyIntents(requestedIntents: bigint | null | undefined): Intents {
    return new Intents(Intents.resolveGatewayIdentifyIntents(requestedIntents));
}

export function getDisallowedPrivilegedIntents(requestedIntents: Intents, configuredPrivilegedIntents: Intents, applicationFlags: number | null | undefined): Intents {
    let disallowed = BigInt(0);

    for (const { intent, flags } of REQUIRED_APPLICATION_FLAGS_BY_PRIVILEGED_INTENT) {
        if (!configuredPrivilegedIntents.has(intent) || !requestedIntents.has(intent)) continue;
        if (((applicationFlags ?? 0) & flags) === 0) disallowed |= intent;
    }

    return new Intents(disallowed);
}

export function hasDisallowedPrivilegedIntents(requestedIntents: Intents, configuredPrivilegedIntents: Intents, applicationFlags: number | null | undefined): boolean {
    return getDisallowedPrivilegedIntents(requestedIntents, configuredPrivilegedIntents, applicationFlags).bitfield !== BigInt(0);
}

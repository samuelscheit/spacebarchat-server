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

import type { Snowflake, ThreadSearchMember } from "@spacebar/schemas";
import type { ThreadMember } from "@spacebar/util";

type ThreadSearchMemberMuteConfig = NonNullable<ThreadSearchMember["mute_config"]>;

type ThreadSearchMemberSource = Pick<ThreadMember, "id" | "join_timestamp" | "flags" | "muted"> & {
    mute_config?: {
        end_time?: Date | string;
        selected_time_window?: number;
    };
};

function toIsoString(value: Date | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
}

function serializeMuteConfig(muteConfig: ThreadSearchMemberSource["mute_config"]): ThreadSearchMemberMuteConfig | undefined {
    if (!muteConfig) return undefined;

    return {
        ...muteConfig,
        end_time: toIsoString(muteConfig.end_time),
    };
}

export function serializeThreadSearchMember(threadMember: ThreadSearchMemberSource, userId: Snowflake): ThreadSearchMember {
    return {
        id: threadMember.id,
        user_id: userId,
        join_timestamp: toIsoString(threadMember.join_timestamp) as string,
        flags: threadMember.flags,
        muted: threadMember.muted,
        mute_config: serializeMuteConfig(threadMember.mute_config),
    };
}

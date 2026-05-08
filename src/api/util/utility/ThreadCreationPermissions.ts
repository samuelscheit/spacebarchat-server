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

import { ChannelType } from "@spacebar/schemas/api/channels/Channel";

export type ThreadCreationType = ChannelType.GUILD_PUBLIC_THREAD | ChannelType.GUILD_PRIVATE_THREAD;
export type ThreadCreationPermission = "CREATE_PUBLIC_THREADS" | "CREATE_PRIVATE_THREADS";

export interface ThreadCreationParent {
    threadOnly(): boolean;
}

export interface ThreadCreatedMessageParent {
    isForum(): boolean;
}

export function resolveThreadCreationType(body: { type?: ThreadCreationType }, parent: ThreadCreationParent): ThreadCreationType {
    return body.type ?? (parent.threadOnly() ? ChannelType.GUILD_PUBLIC_THREAD : ChannelType.GUILD_PRIVATE_THREAD);
}

export function getThreadCreationPermission(threadType: ThreadCreationType): ThreadCreationPermission {
    return threadType === ChannelType.GUILD_PRIVATE_THREAD ? "CREATE_PRIVATE_THREADS" : "CREATE_PUBLIC_THREADS";
}

export function shouldSendThreadCreatedMessage(threadType: ThreadCreationType, parent: ThreadCreatedMessageParent): boolean {
    return threadType !== ChannelType.GUILD_PRIVATE_THREAD && !parent.isForum();
}

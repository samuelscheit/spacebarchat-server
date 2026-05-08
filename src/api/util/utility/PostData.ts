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

import { In, type FindOptionsWhere } from "typeorm";
import { ChannelType } from "@spacebar/schemas/api/channels/Channel";
import type { Channel, Member, ThreadMember } from "@spacebar/util";

export type PostDataThread = Pick<Channel, "id" | "parent_id" | "guild_id" | "owner_id" | "type">;
export type PostDataOwnerMember = Pick<Member, "id" | "guild_id">;
export type PostDataThreadMember = Pick<ThreadMember, "id">;

type PermissionLike = {
    has: (permission: "MANAGE_THREADS") => boolean;
};

export function uniquePostDataThreadIds(threadIds: readonly string[]): string[] {
    return [...new Set(threadIds)];
}

export function createPostDataThreadWhere(parentChannelId: string, threadIds: readonly string[]): FindOptionsWhere<Channel> | undefined {
    const uniqueThreadIds = uniquePostDataThreadIds(threadIds);
    if (!uniqueThreadIds.length) return undefined;

    return {
        id: In(uniqueThreadIds) as FindOptionsWhere<Channel>["id"],
        parent_id: parentChannelId,
    };
}

export function createPostDataOwnerMemberWhere(threads: readonly PostDataThread[]): FindOptionsWhere<Member>[] {
    const seen = new Set<string>();
    const where: FindOptionsWhere<Member>[] = [];

    for (const thread of threads) {
        if (!thread.owner_id || !thread.guild_id) continue;

        const key = `${thread.guild_id}:${thread.owner_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        where.push({
            id: thread.owner_id,
            guild_id: thread.guild_id,
        });
    }

    return where;
}

export function findPostDataOwner<TMember extends PostDataOwnerMember>(members: readonly TMember[], thread: PostDataThread): TMember | undefined {
    return members.find(({ id, guild_id }) => id === thread.owner_id && guild_id === thread.guild_id);
}

export function filterPostDataThreadsForViewer<TThread extends PostDataThread>(
    threads: readonly TThread[],
    threadMembers: readonly PostDataThreadMember[],
    viewerId: string,
    parentPermission: PermissionLike,
): TThread[] {
    if (parentPermission.has("MANAGE_THREADS")) return [...threads];

    const joinedThreadIds = new Set(threadMembers.map(({ id }) => id));

    return threads.filter((thread) => {
        if (thread.type !== ChannelType.GUILD_PRIVATE_THREAD) return true;
        return thread.owner_id === viewerId || joinedThreadIds.has(thread.id);
    });
}

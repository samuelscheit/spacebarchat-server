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

import { emitEvent, GuildMemberUpdateEvent, Member, User, UserUpdateEvent } from "@spacebar/util";
import type { FindManyOptions } from "typeorm";

type UserUpdateEventUser = Omit<User, "data"> & Pick<User, "id" | "toPublicUser">;
type EmitUserUpdateEventsDeps = {
    emit: typeof emitEvent;
    findMemberships: (options: FindManyOptions<Member>) => Promise<Member[]>;
};

const defaultDeps: EmitUserUpdateEventsDeps = {
    emit: emitEvent,
    findMemberships: (options) => Member.find(options),
};

export async function emitUserUpdateEvents(user: UserUpdateEventUser, deps: EmitUserUpdateEventsDeps = defaultDeps) {
    await deps.emit({
        event: "USER_UPDATE",
        user_id: user.id,
        data: user,
    } satisfies UserUpdateEvent);

    const memberships = await deps.findMemberships({
        where: { id: user.id },
        relations: { roles: true },
    });
    const publicUser = user.toPublicUser();

    await Promise.all(
        memberships.map((member) =>
            deps.emit({
                event: "GUILD_MEMBER_UPDATE",
                guild_id: member.guild_id,
                data: {
                    guild_id: member.guild_id,
                    joined_at: member.joined_at,
                    nick: member.nick,
                    pending: member.pending,
                    premium_since: member.premium_since,
                    roles: (member.roles ?? []).filter((role) => role.id !== member.guild_id).map((role) => role.id),
                    user: publicUser,
                },
            } satisfies GuildMemberUpdateEvent),
        ),
    );
}

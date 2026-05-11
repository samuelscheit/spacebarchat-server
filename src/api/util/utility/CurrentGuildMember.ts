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

import { PublicMemberProjection, PublicUserProjection, type CurrentGuildMemberResponse, type PublicMember, type PublicUser } from "@spacebar/schemas";
import { Member, type Guild, type Role } from "@spacebar/util";
import { Permissions } from "@spacebar/util/util/Permissions";

type CurrentGuildMemberRole = Pick<Role, "id" | "permissions">;

type CurrentGuildMemberUser = Pick<PublicUser, "id"> & {
    flags?: number;
};

export type CurrentGuildMemberSource = Pick<Member, "id" | "guild_id" | "communication_disabled_until"> & {
    guild: Pick<Guild, "id" | "owner_id">;
    roles?: CurrentGuildMemberRole[] | null;
    user?: CurrentGuildMemberUser | null;
    toPublicMember(): PublicMember;
};

export async function findCurrentGuildMember(userId: string, guildId: string): Promise<CurrentGuildMemberResponse> {
    const member = await Member.findOneOrFail({
        where: { id: userId, guild_id: guildId },
        relations: { guild: true, roles: true, user: true },
        select: {
            index: true,
            ...Object.fromEntries(PublicMemberProjection.map((field) => [field, true])),
            guild: {
                id: true,
                owner_id: true,
            },
            roles: {
                id: true,
                permissions: true,
            },
            user: Object.fromEntries([...new Set([...PublicUserProjection, "flags"])].map((field) => [field, true])),
        },
    });

    return serializeCurrentGuildMember(member);
}

export function serializeCurrentGuildMember(member: CurrentGuildMemberSource): CurrentGuildMemberResponse {
    const roles = member.roles ?? [];
    const publicMember = member.toPublicMember();
    const permissions = Permissions.finalPermission({
        user: {
            id: member.id,
            roles: roles.map((role) => role.id),
            resolved_roles: roles as Role[],
            communication_disabled_until: member.communication_disabled_until ?? null,
            flags: member.user?.flags ?? 0,
        },
        guild: {
            id: member.guild.id,
            owner_id: member.guild.owner_id ?? "",
        },
    });

    return {
        ...publicMember,
        permissions: permissions.bitfield.toString(),
    };
}

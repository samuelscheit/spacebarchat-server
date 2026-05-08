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

import type { PartialUser } from "@spacebar/schemas";

const PartialUserProjection = [
    "id",
    "username",
    "discriminator",
    "global_name",
    "avatar",
    "avatar_decoration_data",
    "collectibles",
    "display_name_styles",
    "primary_guild",
    "bot",
    "system",
    "banner",
    "accent_color",
    "public_flags",
] satisfies (keyof PartialUser)[];

export function toPartialUser(user: object): PartialUser {
    const source =
        "toPublicUser" in user && typeof user.toPublicUser === "function"
            ? (user.toPublicUser() as Record<keyof PartialUser, unknown>)
            : (user as Record<keyof PartialUser, unknown>);
    const partialUser = {} as PartialUser;

    for (const key of PartialUserProjection) {
        if (source[key] !== undefined) {
            partialUser[key] = source[key] as never;
        }
    }

    if (partialUser.avatar === undefined) partialUser.avatar = null;

    return partialUser;
}

export function toPartialUsers(users: object[] | null | undefined): PartialUser[] {
    return users?.map((user) => toPartialUser(user)) ?? [];
}

/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Ban, DiscordApiErrors, Guild } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { EntityManager, FindOptionsWhere } from "typeorm";
import { getInviteAcceptanceDenial, InviteAcceptanceDenial } from "./InviteAcceptancePolicy";

export interface InviteAcceptanceContext {
    guildId: string;
    userId?: string;
    ip?: string;
    publicFlags?: bigint | number | string | null;
    manager?: EntityManager;
}

function throwInviteAcceptanceDenial(denial: InviteAcceptanceDenial): never {
    switch (denial) {
        case "USER_BANNED":
            throw DiscordApiErrors.USER_BANNED;
        case "QUARANTINED":
            throw DiscordApiErrors.UNKNOWN_INVITE;
        case "INTERNAL_EMPLOYEE_ONLY":
            throw new HTTPError("Only intended for the staff of this instance.", 401);
        case "INVITES_DISABLED":
            throw new HTTPError("Sorry, this guild has joins closed.", 403);
        default: {
            const exhaustive: never = denial;
            throw new Error(`Unknown invite acceptance denial: ${exhaustive}`);
        }
    }
}

export async function assertInviteAcceptanceAllowed(context: InviteAcceptanceContext): Promise<void> {
    const guildRepository = context.manager?.getRepository(Guild) ?? Guild.getRepository();
    const banRepository = context.manager?.getRepository(Ban) ?? Ban.getRepository();

    const banWhere: FindOptionsWhere<Ban>[] = [];
    if (context.userId) banWhere.push({ guild_id: context.guildId, user_id: context.userId });
    if (context.ip) banWhere.push({ guild_id: context.guildId, ip: context.ip });

    const [guild, ban] = await Promise.all([
        guildRepository.findOneOrFail({
            where: { id: context.guildId },
            select: { id: true, features: true },
        }),
        banWhere.length ? banRepository.findOne({ where: banWhere }) : Promise.resolve(null),
    ]);

    const denial = getInviteAcceptanceDenial({
        banned: Boolean(ban),
        features: guild.features,
        publicFlags: context.publicFlags,
    });

    if (denial) {
        const reason = ban ? ` but is banned by ${ban.user_id === context.userId ? "User ID" : "IP address"}` : "";
        console.log(`[Invite] User ${context.userId ?? "new registration"} tried to join guild ${context.guildId}${reason}.`);
        throwInviteAcceptanceDenial(denial);
    }
}

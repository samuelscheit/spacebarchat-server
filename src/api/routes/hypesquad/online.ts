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

import { route } from "@spacebar/api";
import { emitUserUpdateEvents } from "@spacebar/api/util";
import { HypeSquadOnlineCreateSchema, HypeSquadOnlineHouse, PrivateUserProjection, UserFlags } from "@spacebar/schemas";
import { User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export const HYPESQUAD_ONLINE_HOUSE_MASK = UserFlags.FLAGS.HOUSE_BRAVERY | UserFlags.FLAGS.HOUSE_BRILLIANCE | UserFlags.FLAGS.HOUSE_BALANCE;

const HYPESQUAD_ONLINE_HOUSE_FLAGS = {
    [HypeSquadOnlineHouse.Bravery]: UserFlags.FLAGS.HOUSE_BRAVERY,
    [HypeSquadOnlineHouse.Brilliance]: UserFlags.FLAGS.HOUSE_BRILLIANCE,
    [HypeSquadOnlineHouse.Balance]: UserFlags.FLAGS.HOUSE_BALANCE,
} satisfies Record<HypeSquadOnlineHouse, bigint>;

type HypeSquadOnlineUser = Pick<User, "flags" | "public_flags">;

export function updateHypeSquadOnlineFlags(currentFlags: number | null | undefined, nextHouseFlag?: bigint) {
    const flags = new UserFlags(currentFlags ?? 0).remove(HYPESQUAD_ONLINE_HOUSE_MASK);
    if (nextHouseFlag !== undefined) flags.add(nextHouseFlag);

    return Number(flags.bitfield);
}

export function setHypeSquadOnlineHouse(user: HypeSquadOnlineUser, houseId: HypeSquadOnlineHouse) {
    const houseFlag = HYPESQUAD_ONLINE_HOUSE_FLAGS[houseId];

    user.flags = updateHypeSquadOnlineFlags(user.flags, houseFlag);
    user.public_flags = updateHypeSquadOnlineFlags(user.public_flags, houseFlag);
}

export function clearHypeSquadOnlineHouse(user: HypeSquadOnlineUser) {
    user.flags = updateHypeSquadOnlineFlags(user.flags);
    user.public_flags = updateHypeSquadOnlineFlags(user.public_flags);
}

async function getCurrentUser(userId: string) {
    return User.findOneOrFail({
        where: { id: userId },
        select: PrivateUserProjection,
    });
}

async function saveAndEmitUserUpdate(user: User) {
    await user.save();
    await emitUserUpdateEvents(user);
}

router.post(
    "/",
    route({
        summary: "Join HypeSquad Online",
        description: "Joins a HypeSquad house and applies the matching house badge flags to the current user.",
        requestBody: "HypeSquadOnlineCreateSchema",
        coerceRequestBody: false,
        event: ["USER_UPDATE", "GUILD_MEMBER_UPDATE"],
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as HypeSquadOnlineCreateSchema;
        const user = await getCurrentUser(req.user_id);

        setHypeSquadOnlineHouse(user, body.house_id);
        await saveAndEmitUserUpdate(user);

        res.sendStatus(204);
    },
);

router.delete(
    "/",
    route({
        summary: "Leave HypeSquad Online",
        description: "Leaves the current user's HypeSquad house and removes HypeSquad house badge flags.",
        event: ["USER_UPDATE", "GUILD_MEMBER_UPDATE"],
        responses: {
            204: {},
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const user = await getCurrentUser(req.user_id);

        clearHypeSquadOnlineHouse(user);
        await saveAndEmitUserUpdate(user);

        res.sendStatus(204);
    },
);

export default router;

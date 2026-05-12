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
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function getPremiumGuildSubscriptionCooldown(userId: string): never {
    void userId;

    // Discord's cooldown object requires private boost slot change history. Spacebar
    // does not persist that state, so do not synthesize cooldown limits or timestamps.
    throw DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN;
}

router.get(
    "/",
    route({
        summary: "Get Premium Guild Subscription Cooldown",
        description:
            "Returns the current user's premium guild subscription slot change cooldown when locally persisted state exists. Spacebar does not currently persist Discord boost slot cooldown history, so this compatibility endpoint fails closed instead of fabricating cooldown limits or timestamps.",
        responses: {
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, _res: Response) => {
        getPremiumGuildSubscriptionCooldown(req.user_id);
    },
);

export default router;

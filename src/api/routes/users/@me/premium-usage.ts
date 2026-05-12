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

import { route } from "@spacebar/api";
import type { UserPremiumUsageResponse } from "@spacebar/schemas";
import { User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const PremiumUsageFlag = {
    PremiumDiscriminator: 1 << 0,
    AnimatedAvatar: 1 << 1,
    ProfileBanner: 1 << 2,
} as const;

function hasPremiumUsageFlag(flags: number, flag: number) {
    return (flags & flag) === flag;
}

export function buildUserPremiumUsageResponse(user: Pick<User, "premium_usage_flags">): UserPremiumUsageResponse {
    const rawPremiumUsageFlags = Number(user.premium_usage_flags ?? 0);
    const premiumUsageFlags = Number.isFinite(rawPremiumUsageFlags) ? Math.max(0, Math.trunc(rawPremiumUsageFlags)) : 0;

    return {
        premium_usage_flags: premiumUsageFlags,
        premium_discriminator: {
            used: hasPremiumUsageFlag(premiumUsageFlags, PremiumUsageFlag.PremiumDiscriminator),
        },
        animated_avatar: {
            used: hasPremiumUsageFlag(premiumUsageFlags, PremiumUsageFlag.AnimatedAvatar),
        },
        profile_banner: {
            used: hasPremiumUsageFlag(premiumUsageFlags, PremiumUsageFlag.ProfileBanner),
        },
    };
}

router.get(
    "/",
    route({
        summary: "Get User Premium Usage",
        description:
            "Returns Spacebar's durable current-user premium usage flags. Detailed Discord Nitro usage counters are not persisted locally, so this route exposes only the source-documented premium_usage_flags bitfield and decoded flag names.",
        responses: {
            200: {
                body: "UserPremiumUsageResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const user = await User.findOneOrFail({
            where: { id: req.user_id },
            select: { id: true, premium_usage_flags: true },
        });

        res.status(200).json(buildUserPremiumUsageResponse(user));
    },
);

export default router;

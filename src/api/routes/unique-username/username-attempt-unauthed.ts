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
import { Config, User } from "@spacebar/util";
import { type UniqueUsernameAttemptResponse, type UniqueUsernameAttemptUnauthedSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const DEFAULT_MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 2;
const MIGRATED_USERNAME_PATTERN = /^[a-z0-9._]+$/;
const REPEATED_PERIODS = /\.\./;

const router = Router({ mergeParams: true });

export default router;

export interface UniqueUsernameAttemptPolicy {
    maxLength?: number;
    blockedContains?: readonly string[];
    blockedEquals?: readonly string[];
}

function normalizedMaxUsernameLength(maxLength: number | undefined) {
    const normalized = Math.trunc(Number(maxLength));
    if (!Number.isFinite(normalized)) return DEFAULT_MAX_USERNAME_LENGTH;

    return Math.min(DEFAULT_MAX_USERNAME_LENGTH, Math.max(MIN_USERNAME_LENGTH, normalized));
}

export function uniqueUsernameAttemptPolicyFromConfig(): UniqueUsernameAttemptPolicy {
    const { limits, user } = Config.get();

    return {
        maxLength: limits.user.maxUsername,
        blockedContains: user.blockedContains,
        blockedEquals: user.blockedEquals,
    };
}

export function isUniqueUsernameAttemptEligible(username: unknown, options: UniqueUsernameAttemptPolicy = {}) {
    if (typeof username !== "string") return false;

    const maxUsernameLength = normalizedMaxUsernameLength(options.maxLength);
    if (username.length < MIN_USERNAME_LENGTH || username.length > maxUsernameLength) return false;
    if (!MIGRATED_USERNAME_PATTERN.test(username)) return false;
    if (REPEATED_PERIODS.test(username)) return false;

    const blockedEquals = options.blockedEquals ?? [];
    if (blockedEquals.some((word) => word.length > 0 && username === word.toLowerCase())) return false;

    const blockedContains = options.blockedContains ?? [];
    if (blockedContains.some((word) => word.length > 0 && username.includes(word.toLowerCase()))) return false;

    return true;
}

export async function isUniqueUsernameAttemptTaken(username: string) {
    const existing = await User.createQueryBuilder("user").select("user.id").where("LOWER(user.username) = :username", { username }).getOne();

    return Boolean(existing);
}

router.post(
    "/",
    route({
        summary: "Get Unique Username Eligibility",
        requestBody: "UniqueUsernameAttemptUnauthedSchema",
        coerceRequestBody: false,
        responses: {
            200: {
                body: "UniqueUsernameAttemptResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as UniqueUsernameAttemptUnauthedSchema;
        const response: UniqueUsernameAttemptResponse = {
            taken: isUniqueUsernameAttemptEligible(body.username, uniqueUsernameAttemptPolicyFromConfig()) ? await isUniqueUsernameAttemptTaken(body.username) : null,
        };

        return res.json(response);
    },
);

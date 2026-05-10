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
import type { UniqueUsernameSuggestionResponse } from "@spacebar/schemas";
import { Config, User } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { normalizeUniqueUsernameSuggestionBase, UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE, uniqueUsernameSuggestionCandidate } from "../../../util/UniqueUsernameSuggestion";

const MAX_POMELO_SUGGESTION_ATTEMPTS = 1000;

const router: Router = Router({ mergeParams: true });

export default router;

export interface CurrentUserPomeloSuggestionOptions {
    maxLength?: number;
    blockedContains?: readonly string[];
    blockedEquals?: readonly string[];
    isAvailable?: (username: string) => Promise<boolean> | boolean;
}

export function currentUserPomeloSuggestionPolicyFromConfig(): Pick<CurrentUserPomeloSuggestionOptions, "blockedContains" | "blockedEquals" | "maxLength"> {
    const { limits, user } = Config.get();

    return {
        maxLength: limits.user.maxUsername,
        blockedContains: user.blockedContains,
        blockedEquals: user.blockedEquals,
    };
}

function isBlockedPomeloSuggestion(username: string, options: Pick<CurrentUserPomeloSuggestionOptions, "blockedContains" | "blockedEquals">) {
    const normalized = username.toLowerCase();
    const blockedEquals = options.blockedEquals ?? [];
    if (blockedEquals.some((word) => word.length > 0 && normalized === word.toLowerCase())) return true;

    const blockedContains = options.blockedContains ?? [];
    return blockedContains.some((word) => word.length > 0 && normalized.includes(word.toLowerCase()));
}

export async function isCurrentUserPomeloSuggestionAvailable(username: string, userId: string) {
    const existing = await User.createQueryBuilder("user")
        .select("user.id")
        .where("LOWER(user.username) = :username", { username: username.toLowerCase() })
        .andWhere("user.id != :userId", { userId })
        .getOne();

    return !existing;
}

export async function createCurrentUserPomeloSuggestion(currentUsername: unknown, userId: string, options: CurrentUserPomeloSuggestionOptions = {}) {
    const policy = {
        ...currentUserPomeloSuggestionPolicyFromConfig(),
        ...options,
    };
    const isAvailable = policy.isAvailable ?? ((username: string) => isCurrentUserPomeloSuggestionAvailable(username, userId));
    const defaultBase = normalizeUniqueUsernameSuggestionBase(UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE, policy.maxLength);
    const preferredBase = normalizeUniqueUsernameSuggestionBase(currentUsername, policy.maxLength);
    const bases = preferredBase === defaultBase ? [defaultBase] : [preferredBase, defaultBase];

    for (const base of bases) {
        if (isBlockedPomeloSuggestion(base, policy)) continue;

        for (let attempt = 0; attempt < MAX_POMELO_SUGGESTION_ATTEMPTS; attempt++) {
            const candidate = uniqueUsernameSuggestionCandidate(base, attempt, policy.maxLength);
            if (isBlockedPomeloSuggestion(candidate, policy)) continue;
            if (await isAvailable(candidate)) return candidate;
        }
    }

    return uniqueUsernameSuggestionCandidate(defaultBase, MAX_POMELO_SUGGESTION_ATTEMPTS, policy.maxLength);
}

router.get(
    "/",
    route({
        summary: "Get Unique Username Suggestions",
        description: "Returns a suggested unique username string based on the current user's username.",
        responses: {
            200: {
                body: "UniqueUsernameSuggestionResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const response: UniqueUsernameSuggestionResponse = {
            username: await createCurrentUserPomeloSuggestion(req.user.username, req.user_id),
        };

        return res.json(response);
    },
);

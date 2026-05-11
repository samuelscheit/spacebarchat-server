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
import type { UserApplicationIdentitiesResponse } from "@spacebar/schemas";
import { User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export type UserApplicationIdentityUserRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type UserApplicationIdentityRepositories = {
    userRepository?: UserApplicationIdentityUserRepository;
};

function getUserRepository(repository?: UserApplicationIdentityUserRepository): UserApplicationIdentityUserRepository {
    return repository ?? (User as unknown as UserApplicationIdentityUserRepository);
}

export function resolveApplicationIdentityUserId(userId: string, requesterId: string): string {
    return userId === "@me" ? requesterId : userId;
}

export async function getUserApplicationIdentitiesResponse(userId: string, repositories: UserApplicationIdentityRepositories = {}): Promise<UserApplicationIdentitiesResponse> {
    await getUserRepository(repositories.userRepository).findOneOrFail({
        where: { id: userId },
        select: { id: true },
    });

    // Spacebar does not yet persist durable application-scoped external identities or profiles.
    return { identities: [] };
}

router.get(
    "/",
    route({
        summary: "Get User Application Identities",
        query: {
            with_profiles: {
                type: "boolean",
                description: "Whether to include application profile information",
            },
        },
        responses: {
            200: {
                body: "UserApplicationIdentitiesResponse",
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
        const { user_id } = req.params as { [key: string]: string };
        const targetUserId = resolveApplicationIdentityUserId(user_id, req.user_id);
        const response = await getUserApplicationIdentitiesResponse(targetUserId);

        return res.json(response);
    },
);

export default router;

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
import type { ApplicationTesterResponse, ApplicationTestersResponse } from "@spacebar/schemas";
import { ApplicationTester, DiscordApiErrors, toPartialUser } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { requireApplicationTesterAccess, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

export type ApplicationTesterSource = {
    state: ApplicationTesterResponse["state"];
    user: object;
};

export type ApplicationTesterListRepository = {
    find(options: unknown): Promise<ApplicationTesterSource[]>;
};

export type ApplicationTesterListRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    testerRepository?: ApplicationTesterListRepository;
};

const snowflakePattern = /^[1-9]\d{16,19}$/;

function isRouteSnowflake(value: string) {
    return snowflakePattern.test(value);
}

function getApplicationTesterRepository(repository?: ApplicationTesterListRepository): ApplicationTesterListRepository {
    return (
        repository ?? {
            find: (options: unknown) => ApplicationTester.find(options as Parameters<typeof ApplicationTester.find>[0]) as unknown as Promise<ApplicationTesterSource[]>,
        }
    );
}

export function serializeApplicationTester(tester: ApplicationTesterSource): ApplicationTesterResponse {
    return {
        user: toPartialUser(tester.user),
        state: tester.state,
    };
}

export async function getApplicationTesters(applicationId: string, actorUserId: string, repositories: ApplicationTesterListRepositories = {}): Promise<ApplicationTestersResponse> {
    if (!isRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationTesterAccess(applicationId, actorUserId, repositories.applicationRepository);

    const testerRepository = getApplicationTesterRepository(repositories.testerRepository);
    const testers = await testerRepository.find({
        where: {
            application_id: applicationId,
        },
        relations: {
            user: true,
        },
        order: {
            user_id: "ASC",
        },
    });

    return testers.map(serializeApplicationTester);
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createOAuth2ApplicationAllowlistRouter(repositories: ApplicationTesterListRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Testers",
            responses: {
                200: {
                    body: "ApplicationTestersResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            try {
                const testers = await getApplicationTesters(req.params.application_id as string, req.user_id, repositories);

                return res.status(200).json(testers);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createOAuth2ApplicationAllowlistRouter();

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
import { ApplicationTester, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { requireApplicationTesterManagement, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

export type ApplicationTesterDeleteResult = {
    affected?: number | null;
};

export type ApplicationTesterRepository = {
    delete(criteria: unknown): Promise<ApplicationTesterDeleteResult | void>;
};

export type ApplicationTesterRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    testerRepository?: ApplicationTesterRepository;
};

const snowflakePattern = /^[1-9]\d{16,19}$/;

function isRouteSnowflake(value: string) {
    return snowflakePattern.test(value);
}

function getApplicationTesterRepository(repository?: ApplicationTesterRepository): ApplicationTesterRepository {
    return (
        repository ?? {
            delete: (criteria: unknown) => ApplicationTester.delete(criteria as Parameters<typeof ApplicationTester.delete>[0]),
        }
    );
}

function didDeleteMatch(deleteResult: ApplicationTesterDeleteResult | void) {
    if (!deleteResult || deleteResult.affected == null) return true;

    return deleteResult.affected > 0;
}

export async function removeApplicationTester(applicationId: string, userId: string, actorUserId: string, repositories: ApplicationTesterRepositories = {}) {
    if (!isRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!isRouteSnowflake(userId)) return false;

    await requireApplicationTesterManagement(applicationId, actorUserId, repositories.applicationRepository);

    const testerRepository = getApplicationTesterRepository(repositories.testerRepository);
    const deleteResult = await testerRepository.delete({
        application_id: applicationId,
        user_id: userId,
    });

    return didDeleteMatch(deleteResult);
}

function sendUnknownUser(res: Response) {
    return res.status(404).json({
        code: DiscordApiErrors.UNKNOWN_USER.code,
        message: DiscordApiErrors.UNKNOWN_USER.message,
    });
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

export function createOAuth2ApplicationAllowlistUserRouter(repositories: ApplicationTesterRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.delete(
        "/",
        route({
            summary: "Remove Application Tester",
            responses: {
                204: {},
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
                const deleted = await removeApplicationTester(req.params.application_id as string, req.params.user_id as string, req.user_id, repositories);
                if (!deleted) return sendUnknownUser(res);

                return res.sendStatus(204);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createOAuth2ApplicationAllowlistUserRouter();

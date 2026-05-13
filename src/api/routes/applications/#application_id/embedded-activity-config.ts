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
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationEmbeddedActivityConfigAccess, type ApplicationCommandAuthorizationRepository } from "../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export const APPLICATION_EMBEDDED_ACTIVITY_CONFIG_UNSUPPORTED_MESSAGE = "Embedded activity config persistence is not supported on this Spacebar instance.";

export type ApplicationEmbeddedActivityConfigDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
};

export function isApplicationEmbeddedActivityConfigRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function createApplicationEmbeddedActivityConfigUnsupportedError(): ApiError {
    return new ApiError(APPLICATION_EMBEDDED_ACTIVITY_CONFIG_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getApplicationEmbeddedActivityConfig(
    applicationId: string,
    userId: string,
    dependencies: ApplicationEmbeddedActivityConfigDependencies = {},
): Promise<never> {
    if (!isApplicationEmbeddedActivityConfigRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationEmbeddedActivityConfigAccess(applicationId, userId, dependencies.applicationRepository);

    // Spacebar does not currently persist Discord embedded activity config state.
    throw createApplicationEmbeddedActivityConfigUnsupportedError();
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function sendUnknownApplicationError(res: Response) {
    return res.status(404).json({
        code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
        message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

function isUnknownApplicationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.UNKNOWN_APPLICATION.code;
}

export function createApplicationEmbeddedActivityConfigRouter(dependencies: ApplicationEmbeddedActivityConfigDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Embedded Activity Config",
            description:
                "Validates access to an application's embedded activity config, then fails closed because Spacebar does not currently persist Discord embedded activity config state.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            try {
                await getApplicationEmbeddedActivityConfig(req.params.application_id as string, req.user_id, dependencies);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                if (isUnknownApplicationError(error)) return sendUnknownApplicationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationEmbeddedActivityConfigRouter();

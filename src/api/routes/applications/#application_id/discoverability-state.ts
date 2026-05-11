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
import type { ApplicationCommandSchema, ApplicationDiscoverabilityStateResponse } from "@spacebar/schemas";
import { Application, ApplicationCommand, DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import type { FindManyOptions } from "typeorm";
import { applicationCommandScopeWhere, serializeApplicationCommand } from "../../../util/utility/ApplicationCommands";
import { canAccessApplicationGiftCodeBatches, type ApplicationCommandAuthorizationTarget } from "../../../util/utility/ApplicationAuthorization";

export const DEFAULT_APPLICATION_DISCOVERABILITY_STATE = 1;
export const DEFAULT_APPLICATION_DISCOVERY_ELIGIBILITY_FLAGS = 2240;

export type ApplicationDiscoverabilityStateSource = ApplicationCommandAuthorizationTarget & {
    discoverability_state?: number | null;
    discovery_eligibility_flags?: number | null;
};

export type ApplicationDiscoverabilityStateApplicationRepository = {
    findOne(options: unknown): Promise<ApplicationDiscoverabilityStateSource | null>;
};

export type ApplicationDiscoverabilityStateCommandRepository = {
    find(options: unknown): Promise<ApplicationCommand[]>;
};

export type ApplicationDiscoverabilityStateRepositories = {
    applicationRepository?: ApplicationDiscoverabilityStateApplicationRepository;
    commandRepository?: ApplicationDiscoverabilityStateCommandRepository;
};

function getApplicationRepository(repository?: ApplicationDiscoverabilityStateApplicationRepository): ApplicationDiscoverabilityStateApplicationRepository {
    return (repository ?? Application) as ApplicationDiscoverabilityStateApplicationRepository;
}

function getCommandRepository(repository?: ApplicationDiscoverabilityStateCommandRepository): ApplicationDiscoverabilityStateCommandRepository {
    return (repository ?? {
        find: (options: unknown) => ApplicationCommand.find(options as FindManyOptions<ApplicationCommand>),
    }) as ApplicationDiscoverabilityStateCommandRepository;
}

export function buildApplicationDiscoverabilityStateResponse(
    application: ApplicationDiscoverabilityStateSource,
    badCommands: ApplicationCommand[] = [],
): ApplicationDiscoverabilityStateResponse {
    return {
        discoverability_state: application.discoverability_state ?? DEFAULT_APPLICATION_DISCOVERABILITY_STATE,
        discovery_eligibility_flags: application.discovery_eligibility_flags ?? DEFAULT_APPLICATION_DISCOVERY_ELIGIBILITY_FLAGS,
        bad_commands: badCommands.map((command) => serializeApplicationCommand(command) as ApplicationCommandSchema),
    };
}

export async function getApplicationDiscoverabilityStateResponse(
    applicationId: string,
    userId: string,
    repositories: ApplicationDiscoverabilityStateRepositories = {},
): Promise<ApplicationDiscoverabilityStateResponse> {
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        relations: {
            owner: true,
            team: {
                members: true,
            },
        },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!canAccessApplicationGiftCodeBatches(application, userId)) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;

    const commandRepository = getCommandRepository(repositories.commandRepository);
    const badCommands = await commandRepository.find({
        where: {
            ...applicationCommandScopeWhere({ applicationId }),
            nsfw: true,
        },
        order: {
            name: "ASC",
            id: "ASC",
        },
    });

    return buildApplicationDiscoverabilityStateResponse(application, badCommands);
}

export function createApplicationDiscoverabilityStateRouter(repositories: ApplicationDiscoverabilityStateRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Discoverability State",
            responses: {
                200: {
                    body: "ApplicationDiscoverabilityStateResponse",
                },
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
            const response = await getApplicationDiscoverabilityStateResponse(req.params.application_id as string, req.user_id, repositories);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createApplicationDiscoverabilityStateRouter();

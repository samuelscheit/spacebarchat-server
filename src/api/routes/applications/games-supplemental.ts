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
import type { ApplicationsGamesSupplementalResponse } from "@spacebar/schemas";
import { Application, FieldErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { In, type Repository } from "typeorm";
import { serializeApplicationGameSupplementalData, type GameSupplementalApplication } from "../../util/utility/GameResponse";

const snowflakePattern = /^\d{1,20}$/;
const maxApplicationIds = 100;

const gameApplicationSelect = {
    id: true,
    name: true,
    icon: true,
    summary: true,
    announcements_channel_id: true,
};

export type ApplicationsGamesSupplementalRepositories = {
    applicationRepository?: Pick<Repository<Application>, "find">;
};

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseApplicationsGamesSupplementalQuery(query: Request["query"]): string[] {
    const applicationIds = [...queryValues(query.application_ids), ...queryValues(query["application_ids[]"]), ...queryValues(query.game_ids), ...queryValues(query["game_ids[]"])];

    if (!applicationIds.length) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_REQUIRED",
                message: "application_ids is required",
            },
        });
    }

    if (applicationIds.length > maxApplicationIds) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: `application_ids must contain between 1 and ${maxApplicationIds} values`,
            },
        });
    }

    if (applicationIds.some((applicationId) => !snowflakePattern.test(applicationId))) {
        throw FieldErrors({
            application_ids: {
                code: "BASE_TYPE_INVALID",
                message: "application_ids must contain valid snowflakes",
            },
        });
    }

    return [...new Set(applicationIds)];
}

export async function listApplicationsGamesSupplementalData(
    applicationIds: string[],
    repositories: ApplicationsGamesSupplementalRepositories = {},
): Promise<ApplicationsGamesSupplementalResponse> {
    const applicationRepository = repositories.applicationRepository ?? Application.getRepository();
    const applications = await applicationRepository.find({
        where: {
            id: In(applicationIds),
        },
        select: gameApplicationSelect,
    });
    const applicationsById = new Map(applications.map((application) => [application.id, application as GameSupplementalApplication]));

    return applicationIds.flatMap((applicationId) => {
        const application = applicationsById.get(applicationId);
        return application ? [serializeApplicationGameSupplementalData(application)] : [];
    });
}

export function createApplicationsGamesSupplementalRouter(repositories: ApplicationsGamesSupplementalRepositories = {}) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Game Supplemental Data",
            description: "Returns locally supported supplemental game metadata for the given application IDs.",
            query: {
                application_ids: {
                    type: "array",
                    required: true,
                    description: `Application IDs to retrieve supplemental game data for (1-${maxApplicationIds}).`,
                },
            },
            responses: {
                200: {
                    body: "ApplicationsGamesSupplementalResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const applicationIds = parseApplicationsGamesSupplementalQuery(req.query);
            const supplementalData = await listApplicationsGamesSupplementalData(applicationIds, repositories);

            return res.status(200).json(supplementalData);
        },
    );

    return router;
}

export default createApplicationsGamesSupplementalRouter();

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
import type { ApplicationDirectoryApplication } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router, type Router as ExpressRouter } from "express";
import { getApplicationDirectoryApplication } from "../../application-directory-static";

type MaybePromise<T> = T | Promise<T>;

export interface ApplicationDirectoryApplicationEmbedQueryOptions {
    with_localizations?: boolean;
}

export type ApplicationDirectoryApplicationEmbedProvider = (
    applicationId: string,
    options: ApplicationDirectoryApplicationEmbedQueryOptions,
) => MaybePromise<ApplicationDirectoryApplication | null | undefined>;

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return value[0];
    return value;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    const entry = firstQueryValue(value);
    if (typeof entry === "boolean") return entry;
    if (entry === "true") return true;
    if (entry === "false") return false;
    return undefined;
}

export function parseApplicationDirectoryApplicationEmbedQuery(query: Request["query"]): ApplicationDirectoryApplicationEmbedQueryOptions {
    return {
        with_localizations: parseOptionalBoolean(query.with_localizations),
    };
}

export function getApplicationDirectoryApplicationEmbed(
    applicationId: string,
    options: ApplicationDirectoryApplicationEmbedQueryOptions = {},
): ApplicationDirectoryApplication | undefined {
    return getApplicationDirectoryApplication(applicationId, {
        locale: undefined,
        nocache: undefined,
        with_localizations: options.with_localizations,
    });
}

export function createApplicationDirectoryApplicationRouter(
    applicationProvider: ApplicationDirectoryApplicationEmbedProvider = getApplicationDirectoryApplicationEmbed,
): ExpressRouter {
    const router = Router({ mergeParams: true });

    router.get(
        "/embed",
        route({
            summary: "Get Application Directory Application Embed",
            query: {
                with_localizations: {
                    type: "boolean",
                    description: "Whether to include source-backed localized directory descriptions.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationDirectoryApplication",
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
            const applicationId = req.params.application_id;
            if (typeof applicationId !== "string" || applicationId.length === 0) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            const application = await applicationProvider(applicationId, parseApplicationDirectoryApplicationEmbedQuery(req.query));
            if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

            res.status(200).json(application);
        },
    );

    return router;
}

export default createApplicationDirectoryApplicationRouter();

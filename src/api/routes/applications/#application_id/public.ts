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
import { toDiscoverableGuild, type PublicApplicationResponse } from "@spacebar/schemas";
import { Application, DiscordApiErrors, GuildFeature, toPartialUser } from "@spacebar/util";
import { Request, Response, Router } from "express";
import type { Repository } from "typeorm";

export type PublicApplicationRepositories = {
    applicationRepository?: Pick<Repository<Application>, "findOne">;
};

function omitUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function firstQueryValue(value: unknown) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return undefined;
}

export function queryBoolean(value: unknown) {
    const first = firstQueryValue(value);
    return first === "true" || first === "1";
}

export function toPublicApplicationResponse(application: Application): PublicApplicationResponse {
    const hasBot = !!application.bot;
    const discoverableGuild = application.guild && application.guild.features?.includes(GuildFeature.Discoverable) ? toDiscoverableGuild(application.guild) : undefined;

    return omitUndefined({
        id: application.id,
        name: application.name,
        description: application.description ?? "",
        icon: application.icon ?? null,
        type: application.type ?? null,
        flags: application.flags,
        verify_key: application.verify_key,
        hook: application.hook,
        summary: application.summary,
        bot: hasBot ? toPartialUser(application.bot!) : undefined,
        bot_public: hasBot ? application.bot_public : undefined,
        bot_require_code_grant: hasBot ? application.bot_require_code_grant : undefined,
        integration_public: application.integration_public,
        integration_require_code_grant: application.integration_require_code_grant,
        tags: application.tags,
        cover_image: application.cover_image ?? undefined,
        install_params: application.install_params ?? undefined,
        terms_of_service_url: application.terms_of_service_url,
        privacy_policy_url: application.privacy_policy_url,
        guild_id: application.guild_id ?? application.guild?.id,
        guild: discoverableGuild,
        custom_install_url: application.custom_install_url,
    });
}

export async function getPublicApplication(
    applicationId: string,
    options: { withGuild?: boolean } = {},
    repositories: PublicApplicationRepositories = {},
): Promise<PublicApplicationResponse> {
    const applicationRepository = repositories.applicationRepository ?? Application.getRepository();
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        relations: options.withGuild
            ? {
                  bot: true,
                  guild: true,
              }
            : {
                  bot: true,
              },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    return toPublicApplicationResponse(application);
}

export function createPublicApplicationRouter(repositories: PublicApplicationRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Partial Application",
            query: {
                with_guild: {
                    type: "boolean",
                    required: false,
                    description: "Whether to include the discoverable linked guild in the response.",
                },
            },
            responses: {
                200: {
                    body: "PublicApplicationResponse",
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
            const application = await getPublicApplication(
                req.params.application_id as string,
                {
                    withGuild: queryBoolean(req.query.with_guild),
                },
                repositories,
            );

            return res.status(200).json(application);
        },
    );

    return router;
}

export default createPublicApplicationRouter();

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

import {
    applicationCommandIdWhere,
    requireApplicationCommandManagement,
    route,
    serializeGuildApplicationCommandPermissions,
    type ApplicationCommandAuthorizationRepository,
} from "@spacebar/api";
import type { GuildApplicationCommandPermissions } from "@spacebar/schemas";
import { ApiError, ApplicationCommand, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { NextFunction, Request, Response, Router } from "express";
import type { FindOneOptions } from "typeorm";

const router = Router({ mergeParams: true });

export const APPLICATION_COMMAND_PERMISSIONS_MISSING_ACCESS = new ApiError("Missing Access", 401, 401);

type GuildExistsOptions = { where: { id: string } };
type ApplicationMemberExistsOptions = { where: { id: string; guild_id: string } };

export type ApplicationCommandPermissionsRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    findCommand?: (options: FindOneOptions<ApplicationCommand>) => Promise<ApplicationCommand | null>;
    guildExists?: (options: GuildExistsOptions) => Promise<boolean>;
    memberExists?: (options: ApplicationMemberExistsOptions) => Promise<boolean>;
};

export type GetApplicationCommandPermissionsOptions = {
    applicationId: string;
    guildId: string;
    commandId: string;
    repositories?: ApplicationCommandPermissionsRepositories;
};

export type ApplicationCommandPermissionsAccessOptions = {
    applicationId: string;
    guildId: string;
    userId: string;
    userIsBot?: boolean;
    repositories?: ApplicationCommandPermissionsRepositories;
};

export async function requireApplicationCommandPermissionsAccess(options: ApplicationCommandPermissionsAccessOptions) {
    if (options.userIsBot) throw DiscordApiErrors.UNAUTHORIZED;

    const repositories = options.repositories ?? {};
    const guildExists = repositories.guildExists ?? ((existsOptions: GuildExistsOptions) => Guild.exists(existsOptions));
    const memberExists = repositories.memberExists ?? ((existsOptions: ApplicationMemberExistsOptions) => Member.exists(existsOptions));

    await requireApplicationCommandManagement(options.applicationId, options.userId, repositories.applicationRepository);

    if (!(await guildExists({ where: { id: options.guildId } }))) throw DiscordApiErrors.UNKNOWN_GUILD;

    if (!(await memberExists({ where: { id: options.applicationId, guild_id: options.guildId } }))) {
        throw APPLICATION_COMMAND_PERMISSIONS_MISSING_ACCESS;
    }
}

export async function getApplicationCommandPermissions(options: GetApplicationCommandPermissionsOptions): Promise<GuildApplicationCommandPermissions | null> {
    const repositories = options.repositories ?? {};
    const findCommand = repositories.findCommand ?? ((findOptions: FindOneOptions<ApplicationCommand>) => ApplicationCommand.findOne(findOptions));
    const command = await findCommand({
        where: [
            applicationCommandIdWhere({ applicationId: options.applicationId }, options.commandId),
            applicationCommandIdWhere({ applicationId: options.applicationId, guildId: options.guildId }, options.commandId),
        ],
    });

    if (!command) return null;

    return serializeGuildApplicationCommandPermissions(command, options.guildId, { includeEmpty: true }) ?? null;
}

function getRouteAccessOptions(req: Request): ApplicationCommandPermissionsAccessOptions {
    return {
        applicationId: req.params.application_id as string,
        guildId: req.params.guild_id as string,
        userId: req.user_id,
        userIsBot: req.user_bot,
    };
}

function getRouteOptions(req: Request): GetApplicationCommandPermissionsOptions {
    return {
        applicationId: req.params.application_id as string,
        guildId: req.params.guild_id as string,
        commandId: req.params.command_id as string,
    };
}

function requireApplicationCommandPermissionsAccessMiddleware(req: Request, _res: Response, next: NextFunction) {
    requireApplicationCommandPermissionsAccess(getRouteAccessOptions(req))
        .then(() => next())
        .catch(next);
}

router.get(
    "/",
    requireApplicationCommandPermissionsAccessMiddleware,
    route({
        permission: ["MANAGE_GUILD", "MANAGE_ROLES"],
        responses: {
            200: { body: "GuildApplicationCommandPermissions" },
            400: { body: "APIErrorResponse" },
            401: { body: "APIErrorResponse" },
            403: { body: "APIErrorResponse" },
            404: { body: "APIErrorResponse" },
        },
        summary: "Get Application Command Permissions",
    }),
    async (req: Request, res: Response) => {
        const permissions = await getApplicationCommandPermissions(getRouteOptions(req));

        if (!permissions) {
            res.status(404).send({ code: 404, message: "Unknown application command" });
            return;
        }

        res.send(permissions);
    },
);

export default router;

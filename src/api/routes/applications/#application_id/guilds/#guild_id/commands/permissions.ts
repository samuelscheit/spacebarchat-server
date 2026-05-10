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

import { applicationCommandScopeWhere, requireApplicationCommandManagement, route, serializeGuildApplicationCommandPermissions } from "@spacebar/api";
import { ApplicationCommand, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { NextFunction, Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

function rejectBotUsers(req: Request, _res: Response, next: NextFunction) {
    if (req.user_bot) throw DiscordApiErrors.UNAUTHORIZED;
    next();
}

async function requireGuildApplicationCommandPermissionAccess(req: Request, res: Response, next: NextFunction) {
    const applicationId = req.params.application_id as string;
    const guildId = req.params.guild_id as string;

    await requireApplicationCommandManagement(applicationId, req.user_id);

    const guildExists = await Guild.exists({ where: { id: guildId } });
    if (!guildExists) throw DiscordApiErrors.UNKNOWN_GUILD;

    if (!(await Member.exists({ where: { id: applicationId, guild_id: guildId } }))) {
        res.status(401).send({ code: 401, message: "Missing Access" });
        return;
    }

    next();
}

router.get(
    "/",
    rejectBotUsers,
    requireGuildApplicationCommandPermissionAccess,
    route({
        permission: ["MANAGE_GUILD", "MANAGE_ROLES"],
        responses: {
            200: { body: "GuildApplicationCommandPermissionsResponse" },
            400: { body: "APIErrorResponse" },
            401: { body: "APIErrorResponse" },
            403: { body: "APIErrorResponse" },
            404: { body: "APIErrorResponse" },
        },
        summary: "Get Guild Application Command Permissions",
    }),
    async (req: Request, res: Response) => {
        const applicationId = req.params.application_id as string;
        const guildId = req.params.guild_id as string;

        const commands = await ApplicationCommand.find({
            where: [applicationCommandScopeWhere({ applicationId }), applicationCommandScopeWhere({ applicationId, guildId })],
            order: { id: "ASC" },
        });

        const permissions = commands.map((command) => serializeGuildApplicationCommandPermissions(command, guildId)).filter((value) => value !== undefined);

        res.send(permissions);
    },
);

export default router;

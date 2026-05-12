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
import type { GuildNewMemberAction, GuildNewMemberActionsResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";
import { getCurrentGuildNewMemberWelcome } from "./new-member-welcome";

export interface GuildNewMemberActionsDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<{ id: string } | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
    findNewMemberActions(guildId: string, userId: string | undefined): Promise<GuildNewMemberAction[]>;
}

const defaultDependencies: GuildNewMemberActionsDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<{ id: string } | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
    findNewMemberActions: async (guildId, userId) => {
        void userId;
        return getCurrentGuildNewMemberActions(guildId);
    },
};

export function createGuildNewMemberActionsRouter(dependencies: GuildNewMemberActionsDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild New Member Actions",
            description:
                "Returns locally backed new member action definitions for the authenticated guild member. Spacebar does not currently persist Discord's per-member new member action completion state, so the conservative response is an empty list when no local action source exists.",
            responses: {
                200: {
                    body: "GuildNewMemberActionsResponse",
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
            const { guild_id } = req.params as { [key: string]: string };

            return res.status(200).json(await getGuildNewMemberActionsResponse(guild_id, req.user_id, dependencies));
        },
    );

    return router;
}

export async function getGuildNewMemberActionsResponse(
    guildId: string,
    userId: string | undefined,
    dependencies: GuildNewMemberActionsDependencies = defaultDependencies,
): Promise<GuildNewMemberActionsResponse> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true },
    });
    if (!guild) throw unknownGuildError();

    if (!(await dependencies.isGuildMember(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);

    const actions = await dependencies.findNewMemberActions(guildId, userId);
    return actions.map(cloneGuildNewMemberAction);
}

export async function getCurrentGuildNewMemberActions(guildId: string): Promise<GuildNewMemberActionsResponse> {
    const welcome = await getCurrentGuildNewMemberWelcome(guildId);

    return (welcome?.new_member_actions ?? []).map(cloneGuildNewMemberAction);
}

function cloneGuildNewMemberAction(action: GuildNewMemberAction): GuildNewMemberAction {
    const clone = { ...action };
    if (action.emoji) clone.emoji = { ...action.emoji };
    return clone;
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

export default createGuildNewMemberActionsRouter();

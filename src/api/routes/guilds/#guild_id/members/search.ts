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
import { PublicMemberProjection, PublicUserProjection, type PublicMember } from "@spacebar/schemas";
import { DiscordApiErrors, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

export const GUILD_MEMBER_SEARCH_DEFAULT_LIMIT = 1;
export const GUILD_MEMBER_SEARCH_MAX_LIMIT = 1000;

const PublicMemberColumnProjection = PublicMemberProjection.filter((field) => field !== "roles");

export type GuildMemberSearchOptions = {
    query: string;
    limit: number;
};

export type GuildMemberSearchSource = Pick<Member, "toPublicMember">;

export interface GuildMemberSearchDependencies {
    assertMemberInGuild(userId: string, guildId: string): Promise<void>;
    findMembers(guildId: string, query: string, limit: number): Promise<GuildMemberSearchSource[]>;
}

export const defaultGuildMemberSearchDependencies: GuildMemberSearchDependencies = {
    assertMemberInGuild: (userId, guildId) => Member.IsInGuildOrFail(userId, guildId),
    findMembers: findGuildMembersByQuery,
};

function firstQueryValue(value: unknown): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof candidate === "string" ? candidate : undefined;
}

export function parseGuildMemberSearchQuery(query: Request["query"]): GuildMemberSearchOptions {
    const searchQuery = firstQueryValue(query.query);
    if (searchQuery === undefined) throw new HTTPError("Query is required", 400);

    const rawLimit = firstQueryValue(query.limit);
    const limit = rawLimit === undefined ? GUILD_MEMBER_SEARCH_DEFAULT_LIMIT : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > GUILD_MEMBER_SEARCH_MAX_LIMIT) {
        throw new HTTPError("Limit must be between 1 and 1000", 400);
    }

    return {
        query: searchQuery,
        limit,
    };
}

export function escapeLikePattern(value: string) {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function findGuildMembersByQuery(guildId: string, query: string, limit: number): Promise<Member[]> {
    const pattern = `%${escapeLikePattern(query)}%`;

    return Member.createQueryBuilder("member")
        .leftJoinAndSelect("member.user", "user")
        .leftJoinAndSelect("member.roles", "role")
        .where("member.guild_id = :guildId", { guildId })
        .andWhere("(user.username ILIKE :pattern ESCAPE '\\' OR member.nick ILIKE :pattern ESCAPE '\\')", { pattern })
        .select(["member.index", ...PublicMemberColumnProjection.map((field) => `member.${field}`), ...PublicUserProjection.map((field) => `user.${field}`), "role.id"])
        .orderBy("user.username", "ASC")
        .addOrderBy("member.id", "ASC")
        .take(limit)
        .getMany();
}

export async function searchGuildMembers(
    userId: string,
    guildId: string,
    options: GuildMemberSearchOptions,
    dependencies: GuildMemberSearchDependencies = defaultGuildMemberSearchDependencies,
): Promise<PublicMember[]> {
    await dependencies.assertMemberInGuild(userId, guildId);
    const members = await dependencies.findMembers(guildId, options.query, options.limit);

    return members.map((member) => member.toPublicMember());
}

export function createGuildMemberSearchRouter(dependencies: GuildMemberSearchDependencies = defaultGuildMemberSearchDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Query Guild Members",
            query: {
                query: {
                    type: "string",
                    description: "Query to match username(s) and nickname(s) against",
                    required: true,
                },
                limit: {
                    type: "number",
                    description: "Max number of members to return (1-1000, default 1)",
                    required: false,
                },
            },
            responses: {
                200: {
                    body: "APIMemberArray",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            if (!req.user_bot) throw DiscordApiErrors.BOT_ONLY_ENDPOINT;

            const { guild_id } = req.params as { [key: string]: string };
            const options = parseGuildMemberSearchQuery(req.query);
            const members = await searchGuildMembers(req.user_id, guild_id, options, dependencies);

            return res.json(members);
        },
    );

    return router;
}

export default createGuildMemberSearchRouter();

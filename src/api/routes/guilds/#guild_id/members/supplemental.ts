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
import { GuildMemberJoinSourceType, type GuildMemberSupplemental, type GuildMembersSupplementalResponse } from "@spacebar/schemas";
import { Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { IsNull, Not } from "typeorm";

export type GuildMembersSupplementalMemberSource = Pick<Member, "id" | "joined_by">;

export type GuildMembersSupplementalMemberRepository = {
    find(options: unknown): Promise<GuildMembersSupplementalMemberSource[]>;
};

export type GuildMembersSupplementalGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildMembersSupplementalRepositories = {
    guildRepository?: GuildMembersSupplementalGuildRepository;
    memberRepository?: GuildMembersSupplementalMemberRepository;
};

function getGuildRepository(repository?: GuildMembersSupplementalGuildRepository): GuildMembersSupplementalGuildRepository {
    return repository ?? (Guild as unknown as GuildMembersSupplementalGuildRepository);
}

function getMemberRepository(repository?: GuildMembersSupplementalMemberRepository): GuildMembersSupplementalMemberRepository {
    return repository ?? (Member as unknown as GuildMembersSupplementalMemberRepository);
}

export function toGuildMemberSupplemental(member: GuildMembersSupplementalMemberSource): GuildMemberSupplemental | undefined {
    if (!member.joined_by) return undefined;

    return {
        user_id: member.id,
        join_source_type: GuildMemberJoinSourceType.Unspecified,
        inviter_id: member.joined_by,
    };
}

export function buildGuildMembersSupplementalResponse(members: GuildMembersSupplementalMemberSource[]): GuildMembersSupplementalResponse {
    return members.flatMap((member) => toGuildMemberSupplemental(member) ?? []);
}

export async function getGuildMembersSupplemental(guildId: string, repositories: GuildMembersSupplementalRepositories = {}): Promise<GuildMembersSupplementalResponse> {
    const guildRepository = getGuildRepository(repositories.guildRepository);
    const memberRepository = getMemberRepository(repositories.memberRepository);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    const members = await memberRepository.find({
        where: { guild_id: guildId, joined_by: Not(IsNull()) },
        select: { id: true, joined_by: true },
        order: { id: "ASC" },
    });

    return buildGuildMembersSupplementalResponse(members);
}

export function createGuildMembersSupplementalRouter(repositories: GuildMembersSupplementalRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Members Supplemental",
            description:
                "Returns locally persisted guild member join provenance. Spacebar does not currently persist Discord's private member-safety risk signals or invite-source graph, so this endpoint only exposes supported joined_by provenance.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildMembersSupplementalResponse",
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
            const guildId = req.params.guild_id as string;

            return res.status(200).json(await getGuildMembersSupplemental(guildId, repositories));
        },
    );

    return router;
}

export default createGuildMembersSupplementalRouter();

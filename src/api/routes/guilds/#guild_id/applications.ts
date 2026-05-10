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
import { Application } from "@spacebar/util";
import { PublicUserProjection, TeamMemberState, type APIApplication, type PublicUser, type TeamListTeam } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export type GuildApplicationsQuery = {
    type?: unknown;
    include_team?: unknown;
    channel_id?: unknown;
};

export type GuildApplicationsApplicationRepository = {
    find(options: unknown): Promise<GuildApplicationSource[]>;
};

export type GuildApplicationsRepositories = {
    applicationRepository?: GuildApplicationsApplicationRepository;
};

type PublicUserSource = Partial<PublicUser> & {
    toPublicUser?: () => PublicUser;
};

type TeamMemberSource = TeamListTeam["members"][number];

type TeamSource = Omit<TeamListTeam, "members"> & {
    members?: TeamMemberSource[] | null;
};

export type GuildApplicationSource = Omit<Partial<APIApplication>, "owner" | "bot"> & {
    id: string;
    name: string;
    description?: string | null;
    owner?: PublicUserSource | null;
    bot?: PublicUserSource | null;
    team?: TeamSource | null;
};

export type GuildApplicationListOptions = {
    applicationType?: number;
    includeTeam: boolean;
    channelId?: string;
};

export type GuildApplicationResponse = APIApplication & {
    team?: TeamListTeam;
};

const publicUserSelect = Object.fromEntries(PublicUserProjection.map((field) => [field, true]));

function getApplicationRepository(repository?: GuildApplicationsApplicationRepository): GuildApplicationsApplicationRepository {
    return repository ?? (Application as unknown as GuildApplicationsApplicationRepository);
}

function firstQueryValue(value: unknown): unknown {
    return Array.isArray(value) ? value[0] : value;
}

function queryStringValue(value: unknown): string | undefined {
    const first = firstQueryValue(value);
    return typeof first === "string" && first.length > 0 ? first : undefined;
}

function queryBooleanValue(value: unknown): boolean {
    const first = firstQueryValue(value);
    return first === true || first === "true" || first === "1";
}

function parseApplicationType(value: unknown): number | undefined | null {
    const raw = queryStringValue(value);
    if (raw === undefined) return undefined;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return null;

    return parsed;
}

export function parseGuildApplicationsQuery(query: GuildApplicationsQuery): GuildApplicationListOptions | null {
    const applicationType = parseApplicationType(query.type);
    if (applicationType === null) return null;

    return {
        applicationType,
        includeTeam: queryBooleanValue(query.include_team),
        channelId: queryStringValue(query.channel_id),
    };
}

function toPublicUser(user: PublicUserSource | null | undefined): PublicUser | undefined {
    if (!user) return undefined;
    if (typeof user.toPublicUser === "function") return user.toPublicUser();

    return Object.fromEntries(PublicUserProjection.filter((field) => user[field] !== undefined).map((field) => [field, user[field]])) as PublicUser;
}

function canExposeTeam(application: GuildApplicationSource, userId: string): boolean {
    if (application.owner?.id === userId) return true;

    const team = application.team;
    if (!team) return false;
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

function serializeTeam(team: TeamSource): TeamListTeam {
    return {
        id: team.id,
        icon: team.icon,
        members: team.members ?? [],
        name: team.name,
        owner_user_id: team.owner_user_id,
    };
}

function omitUndefined<T extends object>(value: T): T {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(value)) {
        if (record[key] === undefined) delete record[key];
    }

    return value;
}

export function serializeGuildApplication(application: GuildApplicationSource, userId: string, includeTeam: boolean): GuildApplicationResponse {
    const response: GuildApplicationResponse = {
        id: application.id,
        name: application.name,
        icon: application.icon,
        description: application.description ?? "",
        summary: application.summary,
        type: application.type,
        hook: application.hook,
        bot_public: application.bot_public,
        bot_require_code_grant: application.bot_require_code_grant,
        verify_key: application.verify_key,
        owner: toPublicUser(application.owner),
        flags: application.flags ?? 0,
        redirect_uris: application.redirect_uris,
        rpc_application_state: application.rpc_application_state,
        store_application_state: application.store_application_state,
        verification_state: application.verification_state,
        interactions_endpoint_url: application.interactions_endpoint_url,
        integration_public: application.integration_public,
        integration_require_code_grant: application.integration_require_code_grant,
        discoverability_state: application.discoverability_state,
        discovery_eligibility_flags: application.discovery_eligibility_flags,
        bot: toPublicUser(application.bot),
        tags: application.tags,
        cover_image: application.cover_image,
        install_params: application.install_params,
        terms_of_service_url: application.terms_of_service_url,
        privacy_policy_url: application.privacy_policy_url,
        guild_id: application.guild_id,
        custom_install_url: application.custom_install_url,
    };

    if (includeTeam && application.team && canExposeTeam(application, userId)) response.team = serializeTeam(application.team);

    return omitUndefined(response);
}

export async function getGuildApplications(
    guildId: string,
    userId: string,
    query: GuildApplicationsQuery,
    repositories: GuildApplicationsRepositories = {},
): Promise<GuildApplicationResponse[]> {
    const options = parseGuildApplicationsQuery(query);
    if (!options) return [];
    if (options.channelId) return [];

    const applicationRepository = getApplicationRepository(repositories.applicationRepository);
    const where: Record<string, unknown> = { guild_id: guildId };
    if (options.applicationType !== undefined) where.type = options.applicationType;

    const applications = await applicationRepository.find({
        where,
        relations: {
            bot: true,
            owner: true,
            ...(options.includeTeam ? { team: { members: true } } : {}),
        },
        select: {
            bot: publicUserSelect,
            owner: publicUserSelect,
        },
        order: { id: "ASC" },
    });

    return applications.map((application) => serializeGuildApplication(application, userId, options.includeTeam));
}

export function createGuildApplicationsRouter(repositories: GuildApplicationsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Applications",
            description: "Returns application objects attached to the given guild ID. Requires the MANAGE_GUILD permission.",
            permission: "MANAGE_GUILD",
            query: {
                type: {
                    type: "integer",
                    description: "The type of applications to return.",
                },
                include_team: {
                    type: "boolean",
                    description: "Whether to include team information for owned applications.",
                },
                channel_id: {
                    type: "string",
                    description: "The channel ID to filter by.",
                },
            },
            responses: {
                200: {
                    body: "APIApplicationArray",
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
            const applications = await getGuildApplications(req.params.guild_id as string, req.user_id, req.query, repositories);
            return res.status(200).json(applications);
        },
    );

    return router;
}

export default createGuildApplicationsRouter();

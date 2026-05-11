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
import type { GuildDirectoryBroadcastInfoResponse, Snowflake } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, FieldErrors, Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";

const directoryBroadcastTypeQueryValues = ["0", "1"] as const;
const snowflakePattern = /^\d{1,20}$/;

export interface GuildDirectoryBroadcastInfoQuery {
    type: number;
    entity_id?: Snowflake;
}

export interface GuildDirectoryBroadcastInfoDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<{ id: string } | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
    getBroadcastInfo(guildId: string, userId: string | undefined, query: GuildDirectoryBroadcastInfoQuery): Promise<GuildDirectoryBroadcastInfoResponse>;
}

const defaultDependencies: GuildDirectoryBroadcastInfoDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<{ id: string } | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
    getBroadcastInfo: async (_guildId, _userId, query) => getConservativeBroadcastInfo(query),
};

function guildDirectoryBroadcastQueryError(field: string, code: string, message: string): never {
    throw FieldErrors({
        [field]: {
            code,
            message,
        },
    });
}

function parseDirectoryBroadcastType(value: unknown): number {
    if (value === undefined) {
        guildDirectoryBroadcastQueryError("type", "BASE_TYPE_REQUIRED", "This field is required");
    }

    if (typeof value !== "string" || !directoryBroadcastTypeQueryValues.includes(value as (typeof directoryBroadcastTypeQueryValues)[number])) {
        guildDirectoryBroadcastQueryError("type", "BASE_TYPE_CHOICES", `This field must be one of (${directoryBroadcastTypeQueryValues.join(", ")})`);
    }

    return Number(value);
}

function parseOptionalDirectoryBroadcastEntityId(value: unknown): Snowflake | undefined {
    if (value === undefined) return undefined;

    if (typeof value !== "string") {
        guildDirectoryBroadcastQueryError("entity_id", "BASE_TYPE_STRING", "This field must be a string");
    }

    if (!snowflakePattern.test(value)) {
        guildDirectoryBroadcastQueryError("entity_id", "BASE_TYPE_BAD_FORMAT", "This field must be a valid snowflake");
    }

    return value;
}

export function parseGuildDirectoryBroadcastInfoQuery(query: Request["query"]): GuildDirectoryBroadcastInfoQuery {
    const entity_id = parseOptionalDirectoryBroadcastEntityId(query.entity_id);

    return {
        type: parseDirectoryBroadcastType(query.type),
        ...(entity_id === undefined ? {} : { entity_id }),
    };
}

export function getConservativeBroadcastInfo(query: GuildDirectoryBroadcastInfoQuery): GuildDirectoryBroadcastInfoResponse {
    const response: GuildDirectoryBroadcastInfoResponse = {
        can_broadcast: false,
    };

    if (query.entity_id !== undefined) response.has_broadcast = false;

    return response;
}

export function createGuildDirectoryBroadcastInfoRouter(dependencies: GuildDirectoryBroadcastInfoDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Directory Broadcast Info",
            description: "Returns whether the current guild member can broadcast a directory entry in linked directory channels.",
            query: {
                type: {
                    type: "integer",
                    required: true,
                    description: "Directory entry type to check for broadcast eligibility.",
                    values: [...directoryBroadcastTypeQueryValues],
                },
                entity_id: {
                    type: "string",
                    description: "Directory entry entity ID to check for an existing broadcast.",
                },
            },
            responses: {
                200: {
                    body: "GuildDirectoryBroadcastInfoResponse",
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
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { guild_id } = req.params as { [key: string]: string };
            const query = parseGuildDirectoryBroadcastInfoQuery(req.query);

            return res.status(200).json(await getGuildDirectoryBroadcastInfoResponse(guild_id, req.user_id, query, dependencies));
        },
    );

    return router;
}

export async function getGuildDirectoryBroadcastInfoResponse(
    guildId: string,
    userId: string | undefined,
    query: GuildDirectoryBroadcastInfoQuery,
    dependencies: GuildDirectoryBroadcastInfoDependencies = defaultDependencies,
): Promise<GuildDirectoryBroadcastInfoResponse> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true },
    });
    if (!guild) throw unknownGuildError();

    if (!(await dependencies.isGuildMember(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);

    return dependencies.getBroadcastInfo(guildId, userId, query);
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

export default createGuildDirectoryBroadcastInfoRouter();

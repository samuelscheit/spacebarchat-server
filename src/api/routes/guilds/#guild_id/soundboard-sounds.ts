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
import type { GuildSoundboardSoundsResponse, SoundboardSoundResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, Guild, Member, getPermission } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";

export interface GuildSoundboardSoundQueryOptions {
    includeUser: boolean;
}

export interface GuildSoundboardSoundsDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<{ id: string } | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
    canIncludeSoundboardSoundCreator(userId: string | undefined, guildId: string): Promise<boolean>;
    findGuildSoundboardSounds(guildId: string, options: GuildSoundboardSoundQueryOptions): Promise<SoundboardSoundResponse[]>;
    findGuildSoundboardSound?(guildId: string, soundId: string, options: GuildSoundboardSoundQueryOptions): Promise<SoundboardSoundResponse | null>;
}

export const UNKNOWN_SOUNDBOARD_SOUND = new ApiError("Unknown sound", 10097, 404);

const defaultDependencies: GuildSoundboardSoundsDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<{ id: string } | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
    canIncludeSoundboardSoundCreator: async (userId, guildId) => {
        if (!userId) return false;

        const permissions = await getPermission(userId, guildId);
        return permissions.has("CREATE_GUILD_EXPRESSIONS") || permissions.has("MANAGE_EMOJIS_AND_STICKERS");
    },
    async findGuildSoundboardSounds() {
        // Spacebar does not have soundboard sound persistence yet.
        return [];
    },
};

export function createGuildSoundboardSoundsRouter(dependencies: GuildSoundboardSoundsDependencies = defaultDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Soundboard Sounds",
            responses: {
                200: {
                    body: "GuildSoundboardSoundsResponse",
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

            return res.status(200).json(await getGuildSoundboardSoundsResponse(guild_id, req.user_id, dependencies));
        },
    );

    router.get(
        "/:sound_id",
        route({
            summary: "Get Guild Soundboard Sound",
            responses: {
                200: {
                    body: "SoundboardSoundResponse",
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
            const { guild_id, sound_id } = req.params as { [key: string]: string };

            return res.status(200).json(await getGuildSoundboardSoundResponse(guild_id, sound_id, req.user_id, dependencies));
        },
    );

    return router;
}

export async function getGuildSoundboardSoundsResponse(
    guildId: string,
    userId: string | undefined,
    dependencies: GuildSoundboardSoundsDependencies = defaultDependencies,
): Promise<GuildSoundboardSoundsResponse> {
    const options = await getGuildSoundboardSoundQueryOptions(guildId, userId, dependencies);
    const sounds = await dependencies.findGuildSoundboardSounds(guildId, options);

    return buildGuildSoundboardSoundsResponse(sounds, options);
}

export async function getGuildSoundboardSoundResponse(
    guildId: string,
    soundId: string,
    userId: string | undefined,
    dependencies: GuildSoundboardSoundsDependencies = defaultDependencies,
): Promise<SoundboardSoundResponse> {
    const options = await getGuildSoundboardSoundQueryOptions(guildId, userId, dependencies);
    const sound = await findGuildSoundboardSound(guildId, soundId, options, dependencies);
    if (!sound) throw unknownSoundboardSoundError();

    return buildGuildSoundboardSoundResponse(sound, options);
}

async function getGuildSoundboardSoundQueryOptions(
    guildId: string,
    userId: string | undefined,
    dependencies: GuildSoundboardSoundsDependencies,
): Promise<GuildSoundboardSoundQueryOptions> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true },
    });
    if (!guild) throw unknownGuildError();

    if (!(await dependencies.isGuildMember(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);

    const includeUser = await dependencies.canIncludeSoundboardSoundCreator(userId, guildId);

    return { includeUser };
}

export function buildGuildSoundboardSoundsResponse(sounds: readonly SoundboardSoundResponse[], options: GuildSoundboardSoundQueryOptions): GuildSoundboardSoundsResponse {
    return {
        items: sounds.map((sound) => serializeSoundboardSound(sound, options)),
    };
}

export function buildGuildSoundboardSoundResponse(sound: SoundboardSoundResponse, options: GuildSoundboardSoundQueryOptions): SoundboardSoundResponse {
    return serializeSoundboardSound(sound, options);
}

async function findGuildSoundboardSound(
    guildId: string,
    soundId: string,
    options: GuildSoundboardSoundQueryOptions,
    dependencies: GuildSoundboardSoundsDependencies,
): Promise<SoundboardSoundResponse | null> {
    if (dependencies.findGuildSoundboardSound) return dependencies.findGuildSoundboardSound(guildId, soundId, options);

    const sounds = await dependencies.findGuildSoundboardSounds(guildId, options);
    return sounds.find((sound) => sound.sound_id === soundId) ?? null;
}

function serializeSoundboardSound(sound: SoundboardSoundResponse, options: GuildSoundboardSoundQueryOptions): SoundboardSoundResponse {
    const serialized = { ...sound };
    if (!options.includeUser) delete serialized.user;
    else if (serialized.user) serialized.user = { ...serialized.user };

    return serialized;
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

function unknownSoundboardSoundError() {
    return new ApiError(UNKNOWN_SOUNDBOARD_SOUND.message, UNKNOWN_SOUNDBOARD_SOUND.code, 404);
}

export default createGuildSoundboardSoundsRouter();

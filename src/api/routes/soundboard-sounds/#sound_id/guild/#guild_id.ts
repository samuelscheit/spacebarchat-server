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
import { toDiscoverableGuild, type APIErrorResponse, type DiscoverableGuild, type DiscoverableGuildSource } from "@spacebar/schemas";
import { ApiError, Guild, GuildFeature } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const UNKNOWN_SOUNDBOARD_SOUND = new ApiError("Unknown sound", 10097, 404);

export interface SoundboardSoundGuildRecord extends DiscoverableGuildSource {
    discovery_excluded?: boolean | null;
}

export interface SoundboardSoundGuildDependencies {
    soundExistsInGuild(soundId: string, guildId: string): Promise<boolean>;
    findGuild(guildId: string): Promise<SoundboardSoundGuildRecord | null>;
    isGuildExpressionDiscoverabilityEnabled(guild: SoundboardSoundGuildRecord): Promise<boolean>;
}

const defaultDependencies: SoundboardSoundGuildDependencies = {
    async soundExistsInGuild() {
        // Spacebar does not have soundboard sound persistence yet, so avoid
        // exposing guilds for unverified sound IDs.
        return false;
    },
    async findGuild(guildId: string) {
        return (await Guild.findOne({
            where: { id: guildId },
        })) as SoundboardSoundGuildRecord | null;
    },
    async isGuildExpressionDiscoverabilityEnabled() {
        return true;
    },
};

export function canExposeSoundboardSoundGuild(guild: Pick<SoundboardSoundGuildRecord, "features" | "discovery_excluded">, expressionDiscoverabilityEnabled: boolean): boolean {
    return guild.features.includes(GuildFeature.Discoverable) && guild.discovery_excluded !== true && expressionDiscoverabilityEnabled;
}

export async function getSoundboardSoundGuild(
    soundId: string,
    guildId: string,
    dependencies: SoundboardSoundGuildDependencies = defaultDependencies,
): Promise<DiscoverableGuild | null> {
    const soundExists = await dependencies.soundExistsInGuild(soundId, guildId);
    if (!soundExists) return null;

    const guild = await dependencies.findGuild(guildId);
    if (!guild) return null;

    const expressionDiscoverabilityEnabled = await dependencies.isGuildExpressionDiscoverabilityEnabled(guild);
    if (!canExposeSoundboardSoundGuild(guild, expressionDiscoverabilityEnabled)) return null;

    return toDiscoverableGuild(guild);
}

function sendUnknownSoundboardSound(res: Response) {
    return res.status(404).json({
        code: UNKNOWN_SOUNDBOARD_SOUND.code,
        message: UNKNOWN_SOUNDBOARD_SOUND.message,
    } satisfies APIErrorResponse);
}

export function createSoundboardSoundGuildRouter(dependencies: SoundboardSoundGuildDependencies = defaultDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Soundboard Sound Guild",
            responses: {
                200: {
                    body: "DiscoverableGuild",
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
            const { sound_id, guild_id } = req.params as { [key: string]: string };
            const guild = await getSoundboardSoundGuild(sound_id, guild_id, dependencies);
            if (!guild) return sendUnknownSoundboardSound(res);

            return res.status(200).json(guild);
        },
    );

    return router;
}

export default createSoundboardSoundGuildRouter();

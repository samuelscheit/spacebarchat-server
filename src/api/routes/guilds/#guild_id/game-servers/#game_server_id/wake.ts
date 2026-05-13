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

import { assertGuildMember, route } from "@spacebar/api";
import { ApiError, Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE = "Guild game server wake is not supported on this Spacebar instance.";

export type GuildGameServerWakeGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildGameServerWakeMemberAssertion = (userId: string, guildId: string) => Promise<void>;

export type GuildGameServerWakeDependencies = {
    assertGuildMember?: GuildGameServerWakeMemberAssertion;
    guildRepository?: GuildGameServerWakeGuildRepository;
};

function getGuildRepository(repository?: GuildGameServerWakeGuildRepository): GuildGameServerWakeGuildRepository {
    return repository ?? (Guild as unknown as GuildGameServerWakeGuildRepository);
}

function getGuildMemberAssertion(memberAssertion?: GuildGameServerWakeMemberAssertion): GuildGameServerWakeMemberAssertion {
    return memberAssertion ?? assertGuildMember;
}

export function createGuildGameServerWakeUnsupportedError(): ApiError {
    return new ApiError(GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function wakeGuildGameServer(userId: string, guildId: string, gameServerId: string, dependencies: GuildGameServerWakeDependencies = {}): Promise<never> {
    const guildRepository = getGuildRepository(dependencies.guildRepository);
    const assertRequesterGuildMember = getGuildMemberAssertion(dependencies.assertGuildMember);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });
    await assertRequesterGuildMember(userId, guildId);

    // Discord's wake action depends on provider-backed game-server state and
    // side effects. Spacebar does not persist that state, so do not fabricate
    // a game server object or report a wake that never happened.
    void gameServerId;
    throw createGuildGameServerWakeUnsupportedError();
}

export function createGuildGameServerWakeRouter(dependencies: GuildGameServerWakeDependencies = {}) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Wake Guild Game Server",
            description:
                "Wakes a provider-backed game server attached to a guild. The default Spacebar instance does not persist guild game-server state or integrate with a game-server provider, so this compatibility endpoint validates guild access and fails closed with 501 instead of fabricating wake side effects.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, _res: Response) => {
            const { guild_id, game_server_id } = req.params as { [key: string]: string };

            await wakeGuildGameServer(req.user_id, guild_id, game_server_id, dependencies);
        },
    );

    return router;
}

export default createGuildGameServerWakeRouter();

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
import { emitUserUpdateEvents } from "@spacebar/api/util";
import { PrivateUserProjection, type PrimaryGuild, type UserClanModifySchema } from "@spacebar/schemas";
import { DiscordApiErrors, Member, User } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type UserClanGuild = {
    id: string;
    profile_tag?: string | null;
};

export type UserClanUser = Pick<User, "id" | "primary_guild" | "save" | "toPrivateUser" | "toPublicUser">;

export type UserClanRouteDependencies = {
    findCurrentUser(userId: string): Promise<UserClanUser>;
    findCurrentUserGuild(userId: string, guildId: string): Promise<UserClanGuild>;
    saveCurrentUser(user: UserClanUser): Promise<unknown>;
    emitCurrentUserUpdateEvents(user: UserClanUser): Promise<unknown>;
};

export const defaultUserClanRouteDependencies: UserClanRouteDependencies = {
    async findCurrentUser(userId) {
        return User.findOneOrFail({
            where: { id: userId },
            select: PrivateUserProjection,
        });
    },
    async findCurrentUserGuild(userId, guildId) {
        const member = await Member.findOne({
            where: { id: userId, guild_id: guildId },
            relations: { guild: true },
        });

        if (!member?.guild) throw DiscordApiErrors.UNKNOWN_GUILD;

        return member.guild;
    },
    saveCurrentUser: (user) => user.save(),
    emitCurrentUserUpdateEvents: (user) => emitUserUpdateEvents(user as User),
};

export function resolveRequestedGuildId(body: UserClanModifySchema, currentPrimaryGuild?: PrimaryGuild | null): string | null | undefined {
    if ("identity_guild_id" in body) return body.identity_guild_id ?? null;
    if (body.identity_enabled === true && currentPrimaryGuild?.identity_guild_id) return currentPrimaryGuild.identity_guild_id;

    return undefined;
}

export function buildPrimaryGuildIdentity(body: UserClanModifySchema, currentPrimaryGuild: PrimaryGuild | null | undefined, guild?: UserClanGuild): PrimaryGuild | null {
    const requestedGuildId = resolveRequestedGuildId(body, currentPrimaryGuild);

    if (requestedGuildId === null) {
        if (body.identity_enabled === true) throw DiscordApiErrors.INVALID_FORM_BODY;

        return null;
    }

    if (body.identity_enabled === false) {
        return {
            identity_enabled: false,
            identity_guild_id: null,
            tag: null,
            badge: null,
        };
    }

    if (requestedGuildId === undefined) {
        if (body.identity_enabled === true) throw DiscordApiErrors.INVALID_FORM_BODY;
        if (body.identity_enabled === null && currentPrimaryGuild) {
            return {
                identity_enabled: null,
                identity_guild_id: currentPrimaryGuild.identity_guild_id,
                tag: null,
                badge: null,
            };
        }

        return currentPrimaryGuild ?? null;
    }

    if (!guild || guild.id !== requestedGuildId) throw DiscordApiErrors.UNKNOWN_GUILD;

    const identityEnabled = body.identity_enabled === undefined ? true : body.identity_enabled;
    return {
        identity_enabled: identityEnabled,
        identity_guild_id: requestedGuildId,
        tag: identityEnabled === null ? null : (guild.profile_tag ?? null),
        badge: null,
    };
}

export async function setUserClanIdentity(user: UserClanUser, body: UserClanModifySchema, dependencies: UserClanRouteDependencies) {
    const requestedGuildId = resolveRequestedGuildId(body, user.primary_guild);
    const guild = requestedGuildId ? await dependencies.findCurrentUserGuild(user.id, requestedGuildId) : undefined;

    user.primary_guild = buildPrimaryGuildIdentity(body, user.primary_guild, guild);

    await dependencies.saveCurrentUser(user);
    await dependencies.emitCurrentUserUpdateEvents(user);

    return user;
}

export function createUserClanRouter(dependencies: UserClanRouteDependencies = defaultUserClanRouteDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.put(
        "/",
        route({
            summary: "Set Guild Identity",
            description:
                "Sets the current user's primary guild identity. The selected guild must be one of the current user's guilds; Spacebar uses the guild profile tag as the local clan tag and leaves the badge hash null because guild identity badge assets are not persisted locally.",
            requestBody: "UserClanModifySchema",
            coerceRequestBody: false,
            event: ["USER_UPDATE", "GUILD_MEMBER_UPDATE"],
            responses: {
                200: {
                    body: "APIPrivateUser",
                },
                400: {
                    body: "APIErrorResponse",
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
            const body = (req.body ?? {}) as UserClanModifySchema;
            const user = await dependencies.findCurrentUser(req.user_id);

            await setUserClanIdentity(user, body, dependencies);

            return res.status(200).json(user.toPrivateUser());
        },
    );

    return router;
}

export default createUserClanRouter();

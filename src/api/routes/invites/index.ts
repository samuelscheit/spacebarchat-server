/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { acceptUserInvite, isUserInvite, revokeUserInvite, route, toUserInviteResponse } from "@spacebar/api";
import { Config, DiscordApiErrors, getPermission, getRights, Invite, PublicInviteRelation, SpacebarApiErrors, User } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { assertInviteAcceptanceAllowed } from "../../util/handlers/InviteAcceptance";

const router: Router = Router({ mergeParams: true });

router.get(
    "/:invite_code",
    route({
        responses: {
            "200": {
                body: "InviteResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { invite_code } = req.params as { [key: string]: string };

        const invite = await Invite.findOneOrFail({
            where: { code: invite_code },
            relations: PublicInviteRelation,
        });

        if (!invite.guild_id) {
            if (!isUserInvite(invite)) throw DiscordApiErrors.UNKNOWN_INVITE;
            return res.status(200).send(toUserInviteResponse(invite, await User.getPublicUser(invite.inviter_id)));
        }

        res.status(200).send(invite.toPublicJSON());
    },
);

router.post(
    "/:invite_code",
    route({
        responses: {
            "200": {
                body: "InviteResponse",
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
        if (req.user_bot && !Config.get().user.botsCanUseInvites) throw DiscordApiErrors.BOT_PROHIBITED_ENDPOINT;

        const { invite_code } = req.params as { [key: string]: string };
        const rights = await getRights(req.user_id);
        requireAnyInviteRight(rights);

        const invite = await Invite.findOneOrFail({
            where: { code: invite_code },
        });

        if (!invite.guild_id) {
            requireInviteRight(rights, "ACCEPT_INVITES");
            return res.json(await acceptUserInvite(req.user_id, invite));
        }

        requireInviteRight(rights, "USE_MASS_INVITES");

        await assertInviteAcceptanceAllowed({ guildId: invite.guild_id, userId: req.user_id, ip: req.ip, publicFlags: req.user.public_flags });

        res.json(await Invite.joinGuild(req.user_id, invite_code));
    },
);

function requireAnyInviteRight(rights: Awaited<ReturnType<typeof getRights>>) {
    if (!rights.has("ACCEPT_INVITES") && !rights.has("USE_MASS_INVITES")) {
        throw SpacebarApiErrors.MISSING_RIGHTS.withParams("ACCEPT_INVITES or USE_MASS_INVITES");
    }
}

function requireInviteRight(rights: Awaited<ReturnType<typeof getRights>>, right: "ACCEPT_INVITES" | "USE_MASS_INVITES") {
    if (!rights.has(right)) {
        throw SpacebarApiErrors.MISSING_RIGHTS.withParams(right);
    }
}

// * cant use permission of route() function because path doesn't have guild_id/channel_id
router.delete(
    "/:invite_code",
    route({
        responses: {
            "200": {
                body: "Invite",
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
        const { invite_code } = req.params as { [key: string]: string };
        const invite = await Invite.findOneOrFail({ where: { code: invite_code } });
        const { guild_id, channel_id } = invite;

        if (!guild_id) {
            await revokeUserInvite(req.user_id, invite);
            return res.json({ invite });
        }

        const permission = await getPermission(req.user_id, guild_id, channel_id);

        if (!permission.has("MANAGE_GUILD") && !permission.has("MANAGE_CHANNELS")) throw new HTTPError("You missing the MANAGE_GUILD or MANAGE_CHANNELS permission", 401);

        await Invite.deleteWithVanityUrlFeatureSync(invite, { emitDeleteEvents: true });

        res.json({ invite: invite });
    },
);

export default router;

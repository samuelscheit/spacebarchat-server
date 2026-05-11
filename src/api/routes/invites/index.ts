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
import { RelationshipType, type InviteFriendMembersResponse } from "@spacebar/schemas";
import { ApiError, Config, DiscordApiErrors, getPermission, getRights, Invite, Member, PublicInviteRelation, Relationship, SpacebarApiErrors, User } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";
import { assertInviteAcceptanceAllowed } from "../../util/handlers/InviteAcceptance";

const router: Router = Router({ mergeParams: true });

type InviteFriendMembersInvite = Pick<Invite, "guild_id">;
type InviteFriendMembersRelationship = Pick<Relationship, "to_id">;
type InviteFriendMembersMember = Pick<Member, "id">;
type InviteTargetUsersInvite = {
    channel_id?: string | null;
    code?: string;
    guild_id?: string | null;
    inviter_id?: string | null;
};
type InviteTargetUsersPermission = {
    has(permission: "MANAGE_GUILD" | "VIEW_AUDIT_LOG"): boolean;
};
type InviteTargetUsersDependencies = {
    getPermission(userId: string, guildId: string): Promise<InviteTargetUsersPermission>;
};

export const INVITE_TARGET_USERS_UNSUPPORTED_MESSAGE = "Invite target user files are not supported on this Spacebar instance.";

export function createInviteTargetUsersUnsupportedError(): ApiError {
    return new ApiError(INVITE_TARGET_USERS_UNSUPPORTED_MESSAGE, 0, 501);
}

const inviteTargetUsersDependencies: InviteTargetUsersDependencies = {
    getPermission: async (userId, guildId) => (await getPermission(userId, guildId)) as InviteTargetUsersPermission,
};

export async function buildInviteFriendMembersResponse(userId: string, inviteCode: string): Promise<InviteFriendMembersResponse> {
    const invite = (await Invite.findOneOrFail({
        where: { code: inviteCode },
        select: {
            code: true,
            guild_id: true,
        },
    })) as InviteFriendMembersInvite;

    if (!invite.guild_id) return { friend_member_ids: [] };

    const relationships = (await Relationship.find({
        where: {
            from_id: userId,
            type: RelationshipType.friends,
        },
        select: {
            to_id: true,
        },
        order: {
            to_id: "ASC",
        },
    })) as InviteFriendMembersRelationship[];

    const friendIds = relationships.map((relationship) => relationship.to_id);
    if (!friendIds.length) return { friend_member_ids: [] };

    const members = (await Member.find({
        where: {
            guild_id: invite.guild_id,
            id: In(friendIds),
        },
        select: {
            id: true,
        },
        order: {
            id: "ASC",
        },
    })) as InviteFriendMembersMember[];

    return {
        friend_member_ids: [...new Set(members.map((member) => member.id))].sort(),
    };
}

export async function assertCanReadInviteTargetUsers(userId: string, invite: InviteTargetUsersInvite, dependencies = inviteTargetUsersDependencies): Promise<void> {
    if (invite.inviter_id === userId) return;
    if (!invite.guild_id) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILD or VIEW_AUDIT_LOG");

    const permission = (await dependencies.getPermission(userId, invite.guild_id)) as InviteTargetUsersPermission;
    if (!permission.has("MANAGE_GUILD") && !permission.has("VIEW_AUDIT_LOG")) {
        throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILD or VIEW_AUDIT_LOG");
    }
}

export async function assertCanUpdateInviteTargetUsers(userId: string, invite: InviteTargetUsersInvite, dependencies = inviteTargetUsersDependencies): Promise<void> {
    if (invite.inviter_id === userId) return;
    if (!invite.guild_id) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILD");

    const permission = (await dependencies.getPermission(userId, invite.guild_id)) as InviteTargetUsersPermission;
    if (!permission.has("MANAGE_GUILD")) {
        throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILD");
    }
}

async function findInviteTargetUsersInvite(inviteCode: string): Promise<InviteTargetUsersInvite> {
    return (await Invite.findOneOrFail({
        where: { code: inviteCode },
        select: {
            channel_id: true,
            code: true,
            guild_id: true,
            inviter_id: true,
        },
    })) as InviteTargetUsersInvite;
}

type InviteTargetUsersAuthorizer = (userId: string, invite: InviteTargetUsersInvite) => Promise<void>;

async function rejectUnsupportedInviteTargetUsersRequest(req: Request, authorize: InviteTargetUsersAuthorizer): Promise<never> {
    const { invite_code } = req.params as { invite_code: string };
    const invite = await findInviteTargetUsersInvite(invite_code);

    await authorize(req.user_id, invite);

    // Spacebar does not persist Discord target-users CSV files or the async
    // processing job needed by the paired PUT/job-status endpoints.
    throw createInviteTargetUsersUnsupportedError();
}

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

router.get(
    "/:invite_code/friend-members",
    route({
        summary: "Get Invite Friend Members",
        responses: {
            200: {
                body: "InviteFriendMembersResponse",
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
        const { invite_code } = req.params as { invite_code: string };

        res.status(200).json(await buildInviteFriendMembersResponse(req.user_id, invite_code));
    },
);

router.get(
    "/:invite_code/target-users",
    route({
        summary: "Get Invite Target Users",
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
        await rejectUnsupportedInviteTargetUsersRequest(req, assertCanReadInviteTargetUsers);
    },
);

router.put(
    "/:invite_code/target-users",
    route({
        summary: "Update Invite Target Users",
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
        await rejectUnsupportedInviteTargetUsersRequest(req, assertCanUpdateInviteTargetUsers);
    },
);

router.get(
    "/:invite_code/target-users/job-status",
    route({
        summary: "Get Invite Target Users Job Status",
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
        await rejectUnsupportedInviteTargetUsersRequest(req, assertCanReadInviteTargetUsers);
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

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

import { Router, Request, Response } from "express";
import { RoleMembersUpdateSchema } from "@spacebar/schemas";
import { DiscordApiErrors, Member } from "@spacebar/util";
import {
    getMissingRoleMemberIds,
    getRoleMemberIdsToAdd,
    getRoleMemberIdsToRemove,
    normalizeRoleMemberPatchIds,
    route,
    type RoleMemberSnapshot,
    type RoleMemberUpdateMode,
} from "@spacebar/api";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";

const router = Router({ mergeParams: true });

function toRoleMemberSnapshot(member: Member): RoleMemberSnapshot {
    return { id: member.id, role_ids: member.roles.map((role) => role.id) };
}

async function getRoleMemberSnapshots(guild_id: string, member_ids: string[], mode: RoleMemberUpdateMode): Promise<RoleMemberSnapshot[]> {
    const members = await Member.find({
        where: mode === "replace" ? { guild_id } : { guild_id, id: In(member_ids) },
        relations: { roles: true },
    });

    return members.map(toRoleMemberSnapshot);
}

async function updateRoleMembers(req: Request, res: Response, mode: RoleMemberUpdateMode) {
    // Payload is JSON containing a list of member_ids to add (PATCH) or set as the exact role membership (PUT).
    const { guild_id, role_id } = req.params as { [key: string]: string };
    const body = req.body as RoleMembersUpdateSchema;

    // don't mess with @everyone
    if (role_id == guild_id) throw DiscordApiErrors.INVALID_ROLE;

    let member_ids: string[];
    try {
        member_ids = normalizeRoleMemberPatchIds(body?.member_ids);
    } catch (error) {
        throw new HTTPError(error instanceof Error ? error.message : "Invalid member_ids", 400);
    }

    if (mode === "add" && member_ids.length === 0) return res.sendStatus(204);

    const memberSnapshots = await getRoleMemberSnapshots(guild_id, member_ids, mode);
    const missingMemberIds = getMissingRoleMemberIds(memberSnapshots, member_ids);
    if (missingMemberIds.length > 0) throw DiscordApiErrors.UNKNOWN_MEMBER;

    const addMemberIds = getRoleMemberIdsToAdd(memberSnapshots, member_ids, role_id);
    const removeMemberIds = mode === "replace" ? getRoleMemberIdsToRemove(memberSnapshots, member_ids, role_id) : [];

    await Member.updateRoleMembers(guild_id, role_id, { addMemberIds, removeMemberIds });

    res.sendStatus(204);
}

router.patch(
    "/",
    route({
        permission: "MANAGE_ROLES",
        requestBody: "RoleMembersUpdateSchema",
        responses: {
            204: {},
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => updateRoleMembers(req, res, "add"),
);
router.put(
    "/",
    route({
        permission: "MANAGE_ROLES",
        requestBody: "RoleMembersUpdateSchema",
        responses: {
            204: {},
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => updateRoleMembers(req, res, "replace"),
);

export default router;

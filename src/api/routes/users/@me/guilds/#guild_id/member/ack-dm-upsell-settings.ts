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
import type { PublicMember, PublicUser } from "@spacebar/schemas";
import { emitEvent, type GuildMemberUpdateEvent, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

export const DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG = 1 << 9;

type MemberRoleLike = string | { id: string };

export type DmSettingsUpsellAckMember = {
    flags: number;
    roles?: MemberRoleLike[] | null;
    user: {
        toPublicUser(): PublicUser;
    };
    save(): Promise<unknown>;
    toPublicMember(): PublicMember;
};

type EmitGuildMemberUpdate = (event: GuildMemberUpdateEvent) => Promise<unknown> | unknown;

export function withDmSettingsUpsellAcknowledgedFlag(flags: number | null | undefined): number {
    return (flags ?? 0) | DM_SETTINGS_UPSELL_ACKNOWLEDGED_FLAG;
}

function serializeMemberRoleIds(member: DmSettingsUpsellAckMember, guildId: string): string[] {
    return (member.roles ?? []).map((role) => (typeof role === "string" ? role : role.id)).filter((roleId) => roleId !== guildId);
}

export function buildDmSettingsUpsellAckMemberUpdateEvent(member: DmSettingsUpsellAckMember, guildId: string): GuildMemberUpdateEvent {
    return {
        event: "GUILD_MEMBER_UPDATE",
        guild_id: guildId,
        data: {
            ...member.toPublicMember(),
            guild_id: guildId,
            roles: serializeMemberRoleIds(member, guildId),
            user: member.user.toPublicUser(),
        },
    } satisfies GuildMemberUpdateEvent;
}

export async function acknowledgeDmSettingsUpsell(member: DmSettingsUpsellAckMember, guildId: string, emitMemberUpdate?: EmitGuildMemberUpdate): Promise<boolean> {
    const nextFlags = withDmSettingsUpsellAcknowledgedFlag(member.flags);
    if (nextFlags === member.flags) return false;

    member.flags = nextFlags;
    await member.save();
    if (emitMemberUpdate) {
        await emitMemberUpdate(buildDmSettingsUpsellAckMemberUpdateEvent(member, guildId));
    } else {
        await emitEvent(buildDmSettingsUpsellAckMemberUpdateEvent(member, guildId));
    }

    return true;
}

router.post(
    "/",
    route({
        responses: {
            204: {},
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        const member = await Member.findOneOrFail({
            where: { id: req.user_id, guild_id },
            relations: { roles: true, user: true },
        });

        await acknowledgeDmSettingsUpsell(member, guild_id);

        return res.sendStatus(204);
    },
);

export default router;

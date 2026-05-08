import type { Member, Role } from "@spacebar/util";
import { Permissions } from "@spacebar/util/util/Permissions";

type JoinedGuild = {
    id: string;
    owner_id?: string;
    member_count?: number;
    presence_count?: number;
    toJSON(): unknown;
};
type JoinedRole = { id: string; permissions?: string };
type JoinedMember = Pick<Member, "id"> & {
    communication_disabled_until?: Date | null;
    guild: JoinedGuild;
    roles?: JoinedRole[];
    user?: { flags?: number };
};

export type UserGuildResponse = Record<string, unknown> & {
    approximate_member_count?: number;
    approximate_presence_count?: number;
    permissions?: string;
};

export function serializeUserGuilds(members: JoinedMember[], withCounts: boolean): Array<JoinedGuild | UserGuildResponse> {
    if (!withCounts) return members.map((member) => member.guild);

    return members.map((member) => {
        const guild = member.guild;

        return {
            ...(guild.toJSON() as Record<string, unknown>),
            approximate_member_count: guild.member_count ?? 0,
            approximate_presence_count: guild.presence_count ?? 0,
            permissions: resolveUserGuildPermissions(member).bitfield.toString(),
        };
    });
}

function resolveUserGuildPermissions(member: JoinedMember) {
    return Permissions.finalPermission({
        user: {
            id: member.id,
            roles: member.roles?.map((role) => role.id) ?? [],
            communication_disabled_until: member.communication_disabled_until ?? null,
            flags: member.user?.flags ?? 0,
        },
        guild: {
            id: member.guild.id,
            owner_id: member.guild.owner_id ?? "",
            roles: (member.roles ?? []) as unknown as Role[],
        },
    });
}

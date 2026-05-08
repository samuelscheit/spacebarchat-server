import type { UserGuildResponse } from "@spacebar/schemas";
import { Member, type Role } from "@spacebar/util";
import { Permissions } from "@spacebar/util/util/Permissions";

type JoinedGuild = {
    id: string;
    owner_id?: string;
    member_count?: number;
    presence_count?: number;
    toJSON(): Pick<UserGuildResponse, "id" | "name"> & Partial<Omit<UserGuildResponse, "permissions">> & { permissions?: string | number };
};
type JoinedRole = { id: string; permissions?: string };
type JoinedMember = Pick<Member, "id"> & {
    communication_disabled_until?: Date | null;
    guild: JoinedGuild;
    roles?: JoinedRole[];
    user?: { flags?: number };
};

export function serializeUserGuilds(members: JoinedMember[], withCounts: boolean): Array<JoinedGuild | UserGuildResponse> {
    if (!withCounts) return members.map((member) => member.guild);

    return members.map((member) => {
        const guild = member.guild;
        const { permissions: _permissions, ...serializedGuild } = guild.toJSON();

        return {
            ...serializedGuild,
            approximate_member_count: guild.member_count ?? 0,
            approximate_presence_count: guild.presence_count ?? 0,
            permissions: resolveUserGuildPermissions(member).bitfield.toString(),
        };
    });
}

export async function countUserGuildOnlinePresences(guildIds: string[]) {
    const uniqueGuildIds = [...new Set(guildIds)];
    if (uniqueGuildIds.length === 0) return new Map<string, number>();

    const rows = await Member.createQueryBuilder("member")
        .select("member.guild_id", "guild_id")
        .addSelect("COUNT(DISTINCT member.id)", "presence_count")
        .innerJoin("member.user", "user")
        .innerJoin("user.sessions", "session")
        .where("member.guild_id IN (:...guildIds)", { guildIds: uniqueGuildIds })
        .andWhere("session.status = :status", { status: "online" })
        .groupBy("member.guild_id")
        .getRawMany<{ guild_id: string; presence_count: string | number }>();

    return new Map(rows.map((row) => [row.guild_id, Number(row.presence_count)]));
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

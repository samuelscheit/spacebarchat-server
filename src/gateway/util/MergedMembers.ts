import type { PublicMember, PublicUser } from "@spacebar/schemas";

type ReadyMergedMemberInput = {
    guild: { id: string };
    roles?: { id: string }[];
    toPublicMember: () => PublicMember;
};

type ReadyMergedMember = PublicMember & {
    guild: { id: string };
    settings: undefined;
};

export function toReadyMergedMember(member: ReadyMergedMemberInput, user: PublicUser): ReadyMergedMember {
    const publicMember = member.toPublicMember();
    const guildId = member.guild.id;

    return {
        ...publicMember,
        roles: member.roles?.filter((role) => role.id !== guildId).map((role) => role.id) ?? [],
        user,
        guild: {
            id: guildId,
        },
        settings: undefined,
    };
}

export function toReadyMergedMembers(members: ReadyMergedMemberInput[], user: PublicUser): ReadyMergedMember[][] {
    return members.map((member) => [toReadyMergedMember(member, user)]);
}

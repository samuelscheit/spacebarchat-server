import { PublicMemberProjection, type PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import { serializeMemberRoleIds, type MemberRoleLike } from "../util/MemberRoles";
import { profilePronouns } from "../util/UserProfile";
import type { User } from "./User";

export const VoiceStateMemberProjection = ["deaf", "hoisted_role", "joined_at", "mute", "roles", "user"] as const;
export const VoiceStateMemberUserProjection = ["avatar", "discriminator", "id", "username"] as const;
export const VoiceStateMemberRelations = { user: true, roles: true } as const;
export type VoiceStateMemberUser = Pick<PublicUser, (typeof VoiceStateMemberUserProjection)[number]>;
export type VoiceStateMember = Pick<PublicMember, "deaf" | "joined_at" | "mute" | "roles"> & {
    hoisted_role?: string;
    user?: VoiceStateMemberUser;
};

function toVoiceStateMemberUser(user: PublicUser): VoiceStateMemberUser {
    return {
        avatar: user.avatar,
        discriminator: user.discriminator,
        id: user.id,
        username: user.username,
    };
}

function getHoistedRoleId(roles: MemberRoleLike[] | null | undefined): string | undefined {
    const hoistedRoles = (roles ?? []).filter(
        (role): role is { hoist?: boolean; id: string; position?: number } => typeof role !== "string" && (role as { hoist?: boolean }).hoist === true,
    );
    hoistedRoles.sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

    return hoistedRoles[0]?.id;
}

type PublicMemberSource = Omit<Partial<PublicMember>, "pronouns" | "roles" | "user"> & {
    pronouns?: string | null;
    roles?: MemberRoleLike[] | null;
    user?: Pick<User, "toPublicUser">;
};

export function memberToPublicMember(source: PublicMemberSource): PublicMember {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member: any = {};
    PublicMemberProjection.forEach((x) => {
        member[x] = source[x];
    });
    member.pronouns = profilePronouns(source.pronouns);

    if (source.roles) member.roles = serializeMemberRoleIds(source.roles);
    if (source.user) member.user = source.user.toPublicUser() as PublicUser;

    return member as PublicMember;
}

export function memberToVoiceStateMember(source: PublicMemberSource): VoiceStateMember {
    const member: VoiceStateMember = {
        deaf: source.deaf,
        joined_at: source.joined_at,
        mute: source.mute,
        roles: serializeMemberRoleIds(source.roles),
    } as VoiceStateMember;
    const hoistedRoleId = getHoistedRoleId(source.roles);

    if (hoistedRoleId) member.hoisted_role = hoistedRoleId;
    if (source.user) member.user = toVoiceStateMemberUser(source.user.toPublicUser() as PublicUser);

    return member;
}

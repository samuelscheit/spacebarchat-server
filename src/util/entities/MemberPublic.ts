import { PublicMemberProjection, type PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import { serializeMemberRoleIds, type MemberRoleLike } from "../util/MemberRoles";
import { profilePronouns } from "../util/UserProfile";
import type { User } from "./User";

export const VoiceStateMemberUserProjection = ["avatar", "discriminator", "id", "username"] as const;
export type VoiceStateMemberUser = Pick<PublicUser, (typeof VoiceStateMemberUserProjection)[number]>;
export type VoiceStateMember = Omit<PublicMember, "user"> & {
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
    const member = memberToPublicMember(source);

    return {
        ...member,
        user: member.user ? toVoiceStateMemberUser(member.user) : undefined,
    };
}

import { PublicMemberProjection, type PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import { serializeMemberRoleIds, type MemberRoleLike } from "../util/MemberRoles";
import { profilePronouns } from "../util/UserProfile";
import type { User } from "./User";

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

import { PublicMemberProjection, type PublicMember } from "../../schemas/api/users/Member";
import type { PublicUser } from "../../schemas/api/users/User";
import type { Role } from "./Role";
import type { User } from "./User";

type PublicMemberSource = Omit<Partial<PublicMember>, "roles" | "user"> & {
    roles?: Pick<Role, "id">[];
    user?: Pick<User, "toPublicUser">;
};

export function memberToPublicMember(source: PublicMemberSource): PublicMember {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member: any = {};
    PublicMemberProjection.forEach((x) => {
        member[x] = source[x];
    });

    if (source.roles) member.roles = source.roles.map((role) => role.id);
    if (source.user) member.user = source.user.toPublicUser() as PublicUser;

    return member as PublicMember;
}

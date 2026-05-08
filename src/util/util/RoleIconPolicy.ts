import { HTTPError } from "lambert-server";
import type { RoleModifySchema } from "@spacebar/schemas";
import type { Rights } from "./Rights";

export const ROLE_ICONS_FEATURE = "ROLE_ICONS";

export interface RoleIconPolicyOptions {
    guildFeatures: readonly string[];
    body: Partial<RoleModifySchema>;
    creating?: boolean;
    rights?: Rights;
}

export interface GuildCreateRolePolicyOptions {
    guildFeatures: readonly string[];
    roles: readonly Partial<RoleModifySchema>[];
    creatingCustomRoles?: boolean;
    rights?: Rights;
}

export function usesRoleIconPerk(body: Partial<RoleModifySchema>) {
    return Boolean((typeof body.icon === "string" && body.icon.length > 0) || (typeof body.unicode_emoji === "string" && body.unicode_emoji.length > 0));
}

function assertCreateRolesRight(rights?: Rights) {
    if (!rights) throw new HTTPError("You are missing the following rights CREATE_ROLES", 403);
    rights.hasThrow("CREATE_ROLES");
}

export function assertRoleIconPolicy({ guildFeatures, body, creating = false, rights }: RoleIconPolicyOptions) {
    if (creating) assertCreateRolesRight(rights);

    if (!usesRoleIconPerk(body)) return;

    if (!guildFeatures.includes(ROLE_ICONS_FEATURE)) {
        throw new HTTPError("Role icons require the ROLE_ICONS guild feature", 403);
    }

    // Animated role icons are intentionally not gated here: the CDN role-icons
    // route accepts only static image MIME types, so animated uploads are
    // rejected before persistence regardless of guild/user policy.
}

export function assertGuildCreateRolePolicy({ guildFeatures, roles, creatingCustomRoles = false, rights }: GuildCreateRolePolicyOptions) {
    if (creatingCustomRoles) assertCreateRolesRight(rights);

    for (const role of roles) {
        assertRoleIconPolicy({ guildFeatures, body: role });
    }
}

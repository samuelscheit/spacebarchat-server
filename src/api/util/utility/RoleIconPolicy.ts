import { HTTPError } from "lambert-server";
import type { RoleModifySchema } from "@spacebar/schemas";
import type { Rights } from "@spacebar/util";

export const ROLE_ICONS_FEATURE = "ROLE_ICONS";

export interface RoleIconPolicyOptions {
    guildFeatures: readonly string[];
    body: Partial<RoleModifySchema>;
    creating?: boolean;
    rights?: Rights;
}

export function usesRoleIconPerk(body: Partial<RoleModifySchema>) {
    return Boolean((typeof body.icon === "string" && body.icon.length > 0) || (typeof body.unicode_emoji === "string" && body.unicode_emoji.length > 0));
}

export function assertRoleIconPolicy({ guildFeatures, body, creating = false, rights }: RoleIconPolicyOptions) {
    if (creating) rights?.hasThrow("CREATE_ROLES");

    if (!usesRoleIconPerk(body)) return;

    if (!guildFeatures.includes(ROLE_ICONS_FEATURE)) {
        throw new HTTPError("Role icons require the ROLE_ICONS guild feature", 403);
    }

    // Animated role icons are intentionally not gated here: the CDN role-icons
    // route accepts only static image MIME types, so animated uploads are
    // rejected before persistence regardless of guild/user policy.
}

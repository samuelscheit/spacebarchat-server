/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { GuildFeature } from "../../../util/util/GuildFeatures";

export type InviteAcceptanceDenial = "USER_BANNED" | "QUARANTINED" | GuildFeature.InternalEmployeeOnly | GuildFeature.InvitesDisabled;

export const InviteAcceptanceUserFlags = {
    DISCORD_EMPLOYEE: 1n << 0n,
    QUARANTINED: 1n << 44n,
} as const;

export interface InviteAcceptancePolicy {
    banned?: boolean;
    features: GuildFeature[];
    publicFlags?: bigint | number | string | null;
}

function hasPublicFlag(publicFlags: InviteAcceptancePolicy["publicFlags"], flag: bigint): boolean {
    return (BigInt(publicFlags ?? 0) & flag) === flag;
}

export function getInviteAcceptanceDenial(policy: InviteAcceptancePolicy): InviteAcceptanceDenial | undefined {
    if (policy.banned) return "USER_BANNED";

    if (hasPublicFlag(policy.publicFlags, InviteAcceptanceUserFlags.QUARANTINED)) return "QUARANTINED";

    if (policy.features.includes(GuildFeature.InternalEmployeeOnly) && !hasPublicFlag(policy.publicFlags, InviteAcceptanceUserFlags.DISCORD_EMPLOYEE))
        return GuildFeature.InternalEmployeeOnly;

    if (policy.features.includes(GuildFeature.InvitesDisabled)) return GuildFeature.InvitesDisabled;

    return undefined;
}

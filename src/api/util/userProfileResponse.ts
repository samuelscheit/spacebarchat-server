/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { PartialConnectedAccountResponse, UserProfileResponse } from "@spacebar/schemas";

type ProfileBadgeResponse = UserProfileResponse["badges"][number];

export interface VisibleConnectedAccountSource {
    id: string;
    type: string;
    name: string;
    verified?: boolean | null;
    metadata_?: object | null;
    metadata_visibility?: number | null;
}

export interface ProfileBadgeSource {
    id: string;
    description: string;
    icon: string;
    link?: string | null;
}

export function toPartialConnectedAccountResponse(source: VisibleConnectedAccountSource): PartialConnectedAccountResponse {
    const response: PartialConnectedAccountResponse = {
        id: source.id,
        type: source.type,
        name: source.name,
        verified: source.verified ?? false,
    };

    if ((source.metadata_visibility ?? 0) !== 0 && source.metadata_ != null) {
        response.metadata = source.metadata_;
    }

    return response;
}

export function toProfileBadgeResponse(source: ProfileBadgeSource): ProfileBadgeResponse {
    const response: ProfileBadgeResponse = {
        id: source.id,
        description: source.description,
        icon: source.icon,
    };

    if (source.link != null) {
        response.link = source.link;
    }

    return response;
}

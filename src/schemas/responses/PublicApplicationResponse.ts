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

import type { ApplicationType } from "../api/developers/Application";
import type { ApplicationInstallParams } from "../api/developers/ApplicationModifySchema";
import type { PartialUser } from "../api/users/User";
import type { Snowflake } from "../Identifiers";
import type { DiscoverableGuild } from "./DiscoverableGuildsResponse";

export interface PublicApplicationResponse {
    id: Snowflake;
    name: string;
    description: string;
    icon: string | null;
    type: ApplicationType | null;
    flags: number;
    verify_key: string;
    hook?: boolean;
    summary?: string;
    bot?: PartialUser;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    integration_public?: boolean;
    integration_require_code_grant?: boolean;
    tags?: string[];
    cover_image?: string | null;
    install_params?: ApplicationInstallParams;
    terms_of_service_url?: string | null;
    privacy_policy_url?: string | null;
    guild_id?: Snowflake;
    guild?: DiscoverableGuild;
    custom_install_url?: string;
}

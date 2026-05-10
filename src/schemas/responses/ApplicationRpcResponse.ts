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
import type { Snowflake } from "../Identifiers";

export interface ApplicationRpcResponse {
    id: Snowflake;
    name: string;
    description: string;
    icon: string | null;
    summary?: string;
    type: ApplicationType | null;
    cover_image?: string | null;
    hook: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    terms_of_service_url?: string | null;
    privacy_policy_url?: string | null;
    install_params?: ApplicationInstallParams | null;
    verify_key: string;
    flags: number;
    tags?: string[];
}

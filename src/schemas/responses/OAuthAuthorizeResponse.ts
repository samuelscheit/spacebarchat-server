/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import type { ApplicationInstallParams, PublicUser, Snowflake } from "@spacebar/schemas";

export interface OAuthAuthorizeResponse {
    location: string;
}

export interface APIApplication {
    id: Snowflake;
    name: string;
    icon?: string | null;
    description: string;
    summary?: string;
    type?: object;
    hook?: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    verify_key?: string;
    owner?: PublicUser;
    flags: number;
    redirect_uris?: string[];
    rpc_application_state?: number;
    store_application_state?: number;
    verification_state?: number;
    interactions_endpoint_url?: string | null;
    integration_public?: boolean;
    integration_require_code_grant?: boolean;
    discoverability_state?: number;
    discovery_eligibility_flags?: number;
    bot?: PublicUser;
    tags?: string[];
    cover_image?: string | null;
    install_params?: ApplicationInstallParams | null;
    terms_of_service_url?: string;
    privacy_policy_url?: string;
    guild_id?: Snowflake;
    custom_install_url?: string;
}

export type APIApplicationArray = APIApplication[];

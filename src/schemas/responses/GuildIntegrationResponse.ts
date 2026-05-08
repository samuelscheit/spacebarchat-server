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

import type { ApplicationInstallParams } from "../api/developers/ApplicationModifySchema";

export interface APIIntegrationApplication {
    id: string;
    name: string;
    icon?: string;
    description: string;
    summary: string;
    type?: object;
    hook: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    verify_key: string;
    flags: number;
    redirect_uris: string[];
    rpc_application_state: number;
    store_application_state: number;
    verification_state: number;
    interactions_endpoint_url?: string;
    integration_public: boolean;
    integration_require_code_grant: boolean;
    discoverability_state: number;
    discovery_eligibility_flags: number;
    tags?: string[];
    cover_image?: string;
    install_params?: ApplicationInstallParams | null;
    terms_of_service_url?: string;
    privacy_policy_url?: string;
    guild_id?: string;
    custom_install_url?: string;
}

export interface APIGuildIntegration {
    id: string;
    name: string;
    type: "discord";
    enabled: boolean;
    syncing: boolean;
    role_id: string | null;
    enable_emoticons: boolean;
    expire_behavior: number;
    expire_grace_period: number;
    user: null;
    account: {
        id: string;
        name: string;
    };
    synced_at: string | null;
    subscriber_count: number;
    revoked: boolean;
    application: APIIntegrationApplication;
}

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
import type { APIApplication } from "./OAuthAuthorizeResponse";

export type EmbeddedActivityPlatform = "web" | "android" | "ios";

export interface EmbeddedActivityPlatformConfig {
    label_from?: string | null;
    label_type: number;
    label_until?: string | null;
    release_phase: string;
    omit_badge_from_surfaces: string[];
}

export interface EmbeddedActivityClientPlatformConfig {
    web: EmbeddedActivityPlatformConfig;
    android: EmbeddedActivityPlatformConfig;
    ios: EmbeddedActivityPlatformConfig;
}

export interface EmbeddedActivityConfig {
    application_id?: string;
    activity_preview_video_asset_id: string | null;
    supported_platforms: EmbeddedActivityPlatform[];
    default_orientation_lock_state: number;
    tablet_default_orientation_lock_state: number;
    requires_age_gate: boolean;
    legacy_responsive_aspect_ratio: boolean;
    premium_tier_requirement: number | null;
    free_period_starts_at: string | null;
    free_period_ends_at: string | null;
    client_platform_config: EmbeddedActivityClientPlatformConfig;
    shelf_rank: number;
    has_csp_exception: boolean;
    has_proxy_request_signing: boolean;
    displays_advertisements: boolean;
    supported_locales: string[];
    blocked_locales: string[];
}

export interface ActivityShelfApplication extends APIApplication {
    embedded_activity_config: EmbeddedActivityConfig;
    flags_new: string;
    integration_types_config?: ActivityShelfApplicationIntegrationTypesConfig;
    is_discoverable: boolean;
    is_monetized: boolean;
    is_verified: boolean;
    max_participants: number | null;
}

export interface ActivityShelfApplicationIntegrationTypeConfig {
    oauth2_install_params?: ApplicationInstallParams | null;
}

export interface ActivityShelfApplicationIntegrationTypesConfig {
    [integration_type: string]: ActivityShelfApplicationIntegrationTypeConfig | null;
}

export interface ActivityShelfApplicationAsset {
    id: string;
    name: string;
    type: number;
}

export interface ActivityShelfAssets {
    [application_id: string]: ActivityShelfApplicationAsset[];
}

export interface ActivityShelfResponse {
    activities: EmbeddedActivityConfig[];
    applications: ActivityShelfApplication[];
    assets: ActivityShelfAssets;
}

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

import type { StringStringDictionary } from "../HelperTypes";
import type { Snowflake } from "../Identifiers";
import type { ApplicationCommand } from "../api/developers/Application";
import type { ApplicationInstallParams } from "../api/developers/ApplicationModifySchema";
import type { PartialUser } from "../api/users/User";
import type { ApplicationDirectoryCategory } from "./ApplicationDirectoryCategoriesResponse";

export enum ApplicationDirectoryItemType {
    APPLICATION = 1,
    LINK = 2,
    APPLICATION_BANNER = 3,
}

export enum ApplicationDirectoryRequestSurface {
    APPLICATION_DIRECTORY = 1,
    APP_LAUNCHER_IN_TEXT = 2,
    APP_LAUNCHER_IN_VOICE_BANNER = 3,
}

export enum ApplicationDirectoryActiveState {
    PREVIEW = 0,
    ACTIVE = 1,
}

export enum ApplicationDirectoryPlatformFlag {
    IOS = 1,
    ANDROID = 2,
    WEB = 4,
}

export enum ApplicationDirectoryCarouselItemType {
    IMAGE = 1,
    VIDEO = 2,
}

export interface ApplicationDirectoryCarouselItem {
    type: ApplicationDirectoryCarouselItemType;
    url: string;
    proxy_url?: string;
}

export interface ApplicationDirectoryExternalUrl {
    name: string;
    url: string;
}

export interface ApplicationDirectoryEntry {
    guild_count: number;
    carousel_items?: ApplicationDirectoryCarouselItem[];
    supported_locales: string[];
    external_urls?: ApplicationDirectoryExternalUrl[];
    popular_application_command_ids?: Snowflake[];
    popular_application_commands?: ApplicationCommand[];
    detailed_description?: string;
    detailed_description_localizations?: StringStringDictionary | null;
    short_description: string;
    short_description_localizations?: StringStringDictionary | null;
}

export interface ApplicationDirectoryIntegrationTypeConfig {
    oauth2_install_params?: ApplicationInstallParams;
}

export interface ApplicationDirectoryEmbeddedActivityConfig {
    [key: string]: unknown;
}

export interface ApplicationDirectoryApplication {
    [key: string]: unknown;
    id: Snowflake;
    name: string;
    icon: string | null;
    description: string;
    summary?: string;
    type: number | null;
    is_monetized?: boolean;
    is_verified?: boolean;
    is_discoverable?: boolean;
    cover_image?: string | null;
    bot?: PartialUser;
    hook?: boolean;
    slug?: string;
    guild_id?: Snowflake;
    storefront_available?: boolean;
    bot_public?: boolean;
    bot_require_code_grant?: boolean;
    terms_of_service_url?: string | null;
    privacy_policy_url?: string | null;
    install_params?: ApplicationInstallParams;
    integration_types_config?: {
        [key: string]: ApplicationDirectoryIntegrationTypeConfig;
    };
    verify_key: string;
    flags: number;
    flags_new?: string;
    max_participants?: number | null;
    embedded_activity_config?: ApplicationDirectoryEmbeddedActivityConfig;
    tags?: string[];
    categories?: ApplicationDirectoryCategory[];
    directory_entry?: ApplicationDirectoryEntry;
}

export interface ApplicationDirectoryCollectionItem {
    id: Snowflake;
    type: ApplicationDirectoryItemType;
    position: number;
    flags: number;
    image_hash: string | null;
    application: ApplicationDirectoryApplication;
}

export interface ApplicationDirectoryCollection {
    id: string;
    type: ApplicationDirectoryItemType;
    position: number;
    surface?: ApplicationDirectoryRequestSurface;
    platforms: number;
    active_state: ApplicationDirectoryActiveState;
    flags: number;
    title: string;
    description: string;
    application_directory_collection_items: ApplicationDirectoryCollectionItem[];
}

export type ApplicationDirectoryCollectionsResponse = ApplicationDirectoryCollection[];

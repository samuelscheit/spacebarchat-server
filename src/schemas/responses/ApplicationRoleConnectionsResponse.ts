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

import type { APIIntegrationApplication } from "./GuildIntegrationResponse";

export interface ApplicationRoleConnectionMetadataValuesResponse {
    [key: string]: string;
}

export interface ApplicationRoleConnectionLocalizationMapResponse {
    [locale: string]: string;
}

export interface ApplicationRoleConnectionMetadataResponse {
    type: number;
    key: string;
    name: string;
    name_localizations?: ApplicationRoleConnectionLocalizationMapResponse;
    description: string;
    description_localizations?: ApplicationRoleConnectionLocalizationMapResponse;
}

export interface ApplicationRoleConnectionResponse {
    platform_name: string | null;
    platform_username: string | null;
    metadata: ApplicationRoleConnectionMetadataValuesResponse;
    application?: APIIntegrationApplication;
    application_metadata?: ApplicationRoleConnectionMetadataResponse[];
}

export type ApplicationRoleConnectionsResponse = ApplicationRoleConnectionResponse[];

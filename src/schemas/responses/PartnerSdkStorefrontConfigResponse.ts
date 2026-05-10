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

export interface PartnerSdkStorefrontConfigResponse {
    promotional_sku_ids: string[];
    promotion_end_datetime: string | null;
    storefronts: PartnerSdkStorefrontConfigStorefront[];
    announcement_modal_config?: PartnerSdkStorefrontConfigAnnouncementModal | null;
}

export interface PartnerSdkStorefrontConfigStorefront {
    application_id: string;
    game_id: string;
    guild_id: string;
    excluded_platforms: string[];
    collectibles_shop_navigation_enabled: boolean;
}

export interface PartnerSdkStorefrontConfigAnnouncementModal {
    application_id: string;
    version: number;
}

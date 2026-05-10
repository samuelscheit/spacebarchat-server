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

export enum PromotionType {
    ThirdParty = 0,
    Bogo = 1,
    ThirdPartyInbound = 3,
    ThirdPartyOutbound = 4,
    MarketingMoment = 5,
    GiftPromotion = 6,
}

export type BogoPromotionType = 1;

export enum PromotionMarketingComponentType {
    AnnouncementModal = 0,
    PremiumTab = 1,
    MarketingPageBanner = 2,
    PaymentModalBanner = 3,
    MobileBottomSheet = 4,
}

export interface PromotionMarketingComponentResponse {
    component_type: PromotionMarketingComponentType;
    id: number;
    promotion_id: string;
    properties: string;
}

export interface PromotionResponse {
    id: string;
    trial_id?: string;
    start_date: string;
    end_date: string;
    outbound_redemption_end_date?: string;
    inbound_header_text?: string;
    inbound_body_text?: string;
    inbound_help_center_link?: string;
    outbound_title?: string;
    outbound_redemption_modal_body?: string;
    outbound_terms_and_conditions?: string;
    outbound_redemption_page_link?: string;
    outbound_redemption_url_format?: string;
    flags?: number;
    inbound_restricted_countries?: string[];
    outbound_restricted_countries?: string[];
    promotion_type: PromotionType;
    partner_id?: string;
    marketing_components?: PromotionMarketingComponentResponse[];
}

export interface BogoPromotionResponse extends PromotionResponse {
    promotion_type: BogoPromotionType;
}

export type PromotionsResponse = PromotionResponse[];

export type BogoPromotionsResponse = BogoPromotionResponse[];

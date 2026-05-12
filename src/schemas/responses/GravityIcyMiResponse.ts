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

export interface GravityIcyMiMessageContext {
    reply_message_id?: string;
    before_message_id?: string;
    after_message_id?: string;
    external_content_application_id?: string;
    reference_message_id?: string;
}

export interface GravityIcyMiItemData {
    channel_id?: string;
    message_id?: string;
    guild_id?: string;
    user_id?: string;
    content_id?: string;
    channel_type?: number;
    has_mention?: boolean;
    message_context?: GravityIcyMiMessageContext;
    [key: string]: unknown;
}

export interface GravityIcyMiDehydratedItem {
    id: string;
    type: number;
    score?: number;
    timestamp?: number;
    data?: GravityIcyMiItemData;
    score_components?: { [component: string]: number };
}

export interface GravityIcyMiResponse {
    items: GravityIcyMiDehydratedItem[];
    load_id: string;
}

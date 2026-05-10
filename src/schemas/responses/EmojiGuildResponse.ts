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

import { Snowflake } from "../Identifiers";
import { EmojiResponse } from "../api/guilds/Emoji";

export interface EmojiGuildResponse {
    id: Snowflake;
    name: string;
    icon?: string | null;
    banner?: string | null;
    splash?: string | null;
    discovery_splash?: string | null;
    description?: string | null;
    features: string[];
    vanity_url_code?: string | null;
    preferred_locale?: string;
    premium_subscription_count?: number | null;
    approximate_member_count: number;
    approximate_presence_count: number;
    emojis?: EmojiResponse[];
    emoji_count?: number;
    auto_removed: boolean;
    primary_category_id?: number | null;
    is_published: boolean;
}

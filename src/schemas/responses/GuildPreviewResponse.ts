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

import type { Snowflake } from "../Identifiers";
import type { EmojiResponse } from "../api/guilds/Emoji";
import type { StickerResponse } from "../api/guilds/Sticker";

export interface GuildPreviewResponse {
    id: Snowflake;
    name: string;
    icon: string | null;
    description: string | null;
    splash: string | null;
    discovery_splash: string | null;
    features: string[];
    emojis: EmojiResponse[];
    stickers: StickerResponse[];
    approximate_member_count: number;
    approximate_presence_count: number;
}

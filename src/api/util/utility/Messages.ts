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

import type { PreloadMessageResponse } from "@spacebar/schemas";
import type { Message } from "@spacebar/util";

export function toPreloadMessageResponse(message: Message): PreloadMessageResponse {
    // https://docs.discord.food/resources/message#preload-messages - reactions are not included in the response
    const { reactions, ...preloadMessage } = message.toJSON();
    void reactions;
    return preloadMessage;
}

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

import type { APIWebhook } from "../api/channels/Webhook";
import type { APIGuild } from "./GuildCreateResponse";

export type OAuth2TokenErrorCode = "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type";

export interface OAuth2TokenResponse {
    token_type: string;
    access_token: string;
    id_token?: string;
    scope: string;
    expires_in: number;
    refresh_token?: string;
    guild?: APIGuild;
    webhook?: APIWebhook;
}

export interface OAuth2TokenErrorResponse {
    error: OAuth2TokenErrorCode;
    error_description?: string;
    error_uri?: string;
}

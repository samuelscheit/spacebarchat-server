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

import { ApiError, DiscordApiErrors } from "@spacebar/util";

const lobbyIdPattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_LOBBY = new ApiError(DiscordApiErrors.UNKNOWN_LOBBY.message, DiscordApiErrors.UNKNOWN_LOBBY.code, 404);

export function isLobbyId(value: unknown): value is string {
    return typeof value === "string" && lobbyIdPattern.test(value);
}

export function assertLobbyId(value: unknown): asserts value is string {
    if (!isLobbyId(value)) throw UNKNOWN_LOBBY;
}

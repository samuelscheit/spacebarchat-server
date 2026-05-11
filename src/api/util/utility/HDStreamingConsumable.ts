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

import type { HDStreamingConsumableApplySchema, HDStreamingConsumableResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import type { Response } from "express";

export const DefaultHDStreamingConsumableResponse: Readonly<HDStreamingConsumableResponse> = Object.freeze({
    entitlement: null,
});

export function getHDStreamingConsumable(): HDStreamingConsumableResponse {
    return { ...DefaultHDStreamingConsumableResponse };
}

export function sendHDStreamingConsumableResponse(res: Response) {
    return res.status(200).json(getHDStreamingConsumable());
}

export function applyHDStreamingConsumable(_body: HDStreamingConsumableApplySchema): void {
    // Spacebar does not currently persist HD streaming consumable inventory, so
    // applying one must fail instead of pretending to mutate a voice channel.
    throw DiscordApiErrors.UNKNOWN_ENTITLEMENT;
}

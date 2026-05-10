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

import type { ConfettiConsumableApplySchema, ConfettiConsumableResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import type { Response } from "express";

export const DefaultConfettiConsumableResponse: Readonly<ConfettiConsumableResponse> = Object.freeze({
    entitlement: null,
    num_potions: 0,
});

export function getConfettiConsumable(): ConfettiConsumableResponse {
    return { ...DefaultConfettiConsumableResponse };
}

export function sendConfettiConsumableResponse(res: Response) {
    return res.status(200).json(getConfettiConsumable());
}

export function applyConfettiConsumable(_body: ConfettiConsumableApplySchema): void {
    // Spacebar does not currently persist consumable inventory, so applying one
    // must fail instead of pretending to mutate a message or consume a potion.
    throw DiscordApiErrors.UNKNOWN_ENTITLEMENT;
}

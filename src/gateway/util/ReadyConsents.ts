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

import type { ReadyEventData } from "@spacebar/util";

export type ReadyConsents = NonNullable<ReadyEventData["consents"]>;

/**
 * Discord-compatible READY consent defaults.
 *
 * Spacebar currently has no persisted personalization-consent model and does
 * not implement `/users/@me/consent`, so READY must expose the conservative
 * non-consented state rather than implying analytics personalization is enabled.
 */
export function createReadyConsents(): ReadyConsents {
    return {
        personalization: {
            consented: false,
        },
    };
}

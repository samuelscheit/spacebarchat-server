/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ValidRegistrationToken } from "../../../util/entities/ValidRegistrationTokens";

export const DefaultRegistrationTokenExpirationMs = 1000 * 60 * 60 * 24 * 7;

function isValidDateMs(value: number) {
    return Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
}

function getRegistrationTokenExpirationDate(expirationMs: number, now: number) {
    const issuedAt = isValidDateMs(now) ? now : Date.now();
    const durationMs = Number.isFinite(expirationMs) && expirationMs > 0 ? expirationMs : DefaultRegistrationTokenExpirationMs;
    const expiresAt = issuedAt + durationMs;

    if (isValidDateMs(expiresAt)) {
        return new Date(expiresAt);
    }

    const fallbackExpiresAt = issuedAt + DefaultRegistrationTokenExpirationMs;
    return new Date(isValidDateMs(fallbackExpiresAt) ? fallbackExpiresAt : Date.now() + DefaultRegistrationTokenExpirationMs);
}

export function createRegistrationTokens(count: number, length: number, expirationMs: number, randomToken: (length: number) => string, now = Date.now()) {
    const expiresAt = getRegistrationTokenExpirationDate(expirationMs, now);
    const tokens: ValidRegistrationToken[] = [];

    for (let i = 0; i < count; i++) {
        const registrationToken = new ValidRegistrationToken();
        registrationToken.token = randomToken(length);
        registrationToken.expires_at = new Date(expiresAt);
        tokens.push(registrationToken);
    }

    return tokens;
}

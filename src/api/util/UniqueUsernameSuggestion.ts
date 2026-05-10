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

import { Config, User } from "@spacebar/util";

const DEFAULT_MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 2;
const MAX_SUGGESTION_ATTEMPTS = 1000;

export const UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE = "user";

const INVALID_UNIQUE_USERNAME_CHARS = /[^a-z0-9._]+/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const APOSTROPHES = /['\u2019]/g;
const REPEATED_DOTS = /\.+/g;
const EDGE_SEPARATORS = /^[._]+|[._]+$/g;
const TRAILING_SEPARATORS = /[._]+$/g;

export function normalizedMaxUsernameLength(maxLength: number | undefined) {
    const normalized = Math.trunc(Number(maxLength));
    if (!Number.isFinite(normalized)) return DEFAULT_MAX_USERNAME_LENGTH;

    return Math.min(DEFAULT_MAX_USERNAME_LENGTH, Math.max(MIN_USERNAME_LENGTH, normalized));
}

function clampUniqueUsernameCandidate(value: string, maxLength: number) {
    const candidate = value.slice(0, maxLength).replace(EDGE_SEPARATORS, "");
    if (candidate.length >= MIN_USERNAME_LENGTH) return candidate;

    return UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE.slice(0, maxLength);
}

export function normalizeUniqueUsernameSuggestionBase(globalName: unknown, maxLength = DEFAULT_MAX_USERNAME_LENGTH) {
    const maxUsernameLength = normalizedMaxUsernameLength(maxLength);
    if (typeof globalName !== "string") return clampUniqueUsernameCandidate(UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE, maxUsernameLength);

    const candidate = globalName
        .trim()
        .normalize("NFKD")
        .replace(COMBINING_MARKS, "")
        .toLowerCase()
        .replace(APOSTROPHES, "")
        .replace(INVALID_UNIQUE_USERNAME_CHARS, ".")
        .replace(REPEATED_DOTS, ".")
        .replace(EDGE_SEPARATORS, "");

    return clampUniqueUsernameCandidate(candidate || UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE, maxUsernameLength);
}

export function uniqueUsernameSuggestionCandidate(base: string, attempt: number, maxLength = DEFAULT_MAX_USERNAME_LENGTH) {
    const maxUsernameLength = normalizedMaxUsernameLength(maxLength);
    if (attempt <= 0) return clampUniqueUsernameCandidate(base, maxUsernameLength);

    const suffix = String(attempt);
    if (suffix.length >= maxUsernameLength) return suffix.slice(0, maxUsernameLength);

    const root = base.slice(0, maxUsernameLength - suffix.length).replace(TRAILING_SEPARATORS, "");
    const candidate = `${root || UNIQUE_USERNAME_SUGGESTION_DEFAULT_BASE.slice(0, maxUsernameLength - suffix.length)}${suffix}`;

    return clampUniqueUsernameCandidate(candidate, maxUsernameLength);
}

export async function isUniqueUsernameSuggestionAvailable(username: string) {
    const existing = await User.findOne({
        where: {
            username,
        },
        select: {
            id: true,
        },
    });

    return !existing;
}

export async function createUniqueUsernameSuggestion(
    globalName: unknown,
    options: {
        maxLength?: number;
        isAvailable?: (username: string) => Promise<boolean>;
    } = {},
) {
    const maxUsernameLength = normalizedMaxUsernameLength(options.maxLength ?? Config.get().limits.user.maxUsername);
    const isAvailable = options.isAvailable ?? isUniqueUsernameSuggestionAvailable;
    const base = normalizeUniqueUsernameSuggestionBase(globalName, maxUsernameLength);

    for (let attempt = 0; attempt < MAX_SUGGESTION_ATTEMPTS; attempt++) {
        const candidate = uniqueUsernameSuggestionCandidate(base, attempt, maxUsernameLength);
        if (await isAvailable(candidate)) return candidate;
    }

    return uniqueUsernameSuggestionCandidate(base, MAX_SUGGESTION_ATTEMPTS, maxUsernameLength);
}

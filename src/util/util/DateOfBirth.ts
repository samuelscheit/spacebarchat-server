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

export type DateOfBirthInput = Date | string;

export type DateOfBirthEvaluation = { status: "missing" } | { status: "invalid" } | { status: "allowed"; parsed: Date } | { status: "underage"; parsed: Date };

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOfBirth(dateOfBirth: DateOfBirthInput): Date | undefined {
    if (dateOfBirth instanceof Date) {
        if (isNaN(dateOfBirth.getTime())) return undefined;
        return new Date(dateOfBirth.getTime());
    }

    const trimmed = dateOfBirth.trim();
    const dateOnlyMatch = dateOnlyPattern.exec(trimmed);
    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]);
        const day = Number(dateOnlyMatch[3]);
        const parsed = new Date(Date.UTC(year, month - 1, day));

        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
            return undefined;
        }

        return parsed;
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return undefined;
    return parsed;
}

export function minimumDateOfBirthForAge(minimumAge: number, referenceDate = new Date()): Date {
    const minimumDateOfBirth = dateOnly(referenceDate);
    minimumDateOfBirth.setUTCFullYear(minimumDateOfBirth.getUTCFullYear() - minimumAge);
    return minimumDateOfBirth;
}

export function evaluateDateOfBirth(dateOfBirth: DateOfBirthInput | undefined, minimumAge: number | undefined, referenceDate = new Date()): DateOfBirthEvaluation {
    if (!dateOfBirth) return { status: "missing" };

    const parsed = parseDateOfBirth(dateOfBirth);
    if (!parsed) return { status: "invalid" };
    if (!minimumAge) return { status: "allowed", parsed };

    if (dateOnly(parsed) <= minimumDateOfBirthForAge(minimumAge, referenceDate)) {
        return { status: "allowed", parsed };
    }

    return { status: "underage", parsed };
}

function dateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

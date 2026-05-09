/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { RegisterSchema } from "../../../schemas/uncategorised/RegisterSchema";
import { DateOfBirthInput, evaluateDateOfBirth } from "../../../util/util/DateOfBirth";

export interface RegistrationInviteConfiguration {
    requireInvite: boolean;
    guestsRequireInvite: boolean;
}

export interface RegistrationDateOfBirthConfiguration {
    required: boolean;
    minimum?: number;
}

export interface RegistrationInvite {
    isExpired(): boolean;
}

export type RegistrationDateOfBirthValidationError = "required" | "invalid" | "underage";

export function registrationRequiresInvite(register: RegistrationInviteConfiguration, body: Pick<RegisterSchema, "email" | "invite">): boolean {
    return !body.invite && (register.requireInvite || (register.guestsRequireInvite && !body.email));
}

export function isRegistrationInviteUsable(invite: RegistrationInvite | null | undefined): invite is RegistrationInvite {
    return invite !== null && invite !== undefined && !invite.isExpired();
}

export function validateRegistrationDateOfBirth(
    dateOfBirthConfig: RegistrationDateOfBirthConfiguration,
    dateOfBirth: DateOfBirthInput | null | undefined,
    now = new Date(),
): RegistrationDateOfBirthValidationError | undefined {
    const result = evaluateDateOfBirth(dateOfBirth, dateOfBirthConfig.minimum, now);

    if (result.status === "missing") return dateOfBirthConfig.required ? "required" : undefined;

    if (result.status === "invalid") return "invalid";
    if (result.status === "underage") return "underage";

    return undefined;
}

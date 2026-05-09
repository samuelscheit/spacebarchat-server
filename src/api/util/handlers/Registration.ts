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

import { FieldErrors } from "@spacebar/util";
import { RegisterSchema } from "../../../schemas/uncategorised/RegisterSchema";
import { type PasswordStrengthPolicy, validatePasswordPolicy } from "../utility/passwordStrength";

export interface RegistrationInviteConfiguration {
    requireInvite: boolean;
    guestsRequireInvite: boolean;
}

export interface RegistrationInvite {
    isExpired(): boolean;
}

export type PasswordPolicyTranslator = (key: string, params?: Record<string, number>) => string;

export function registrationRequiresInvite(register: RegistrationInviteConfiguration, body: Pick<RegisterSchema, "email" | "invite">): boolean {
    return !body.invite && (register.requireInvite || (register.guestsRequireInvite && !body.email));
}

export function isRegistrationInviteUsable(invite: RegistrationInvite | null | undefined): invite is RegistrationInvite {
    return invite !== null && invite !== undefined && !invite.isExpired();
}

export function assertPasswordMeetsPolicy(password: string, policy: PasswordStrengthPolicy, translate: PasswordPolicyTranslator) {
    const validation = validatePasswordPolicy(password, policy);
    if (validation.valid) return;

    const failure = validation.failures[0];
    throw FieldErrors({
        password: {
            code: failure.code,
            message: translate(`auth:register.${failure.code}`, failure.params),
        },
    });
}

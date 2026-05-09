/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { Config, type PasswordConfiguration } from "@spacebar/util";

const reNUMBER = /^\p{Nd}$/u;
const reUPPERCASELETTER = /^\p{Lu}$/u;
const reLETTER_OR_NUMBER = /^[\p{L}\p{N}]$/u;
const PASSWORD_REQUIREMENT_SCORE = 0.05;
const PASSWORD_REQUIREMENT_COUNT = 4;
const ENTROPY_SCORE_WEIGHT = 1 - PASSWORD_REQUIREMENT_SCORE * PASSWORD_REQUIREMENT_COUNT;

export type PasswordRequirementCode =
    | "PASSWORD_REQUIREMENTS_MIN_LENGTH"
    | "PASSWORD_REQUIREMENTS_MIN_NUMBERS"
    | "PASSWORD_REQUIREMENTS_MIN_UPPERCASE"
    | "PASSWORD_REQUIREMENTS_MIN_SYMBOLS"
    | "PASSWORD_REQUIREMENTS_BLOCKLIST";

export type PasswordStrengthPolicy = Pick<PasswordConfiguration, "minLength" | "minNumbers" | "minUpperCase" | "minSymbols"> & Partial<Pick<PasswordConfiguration, "blocklist">>;

export type PasswordPolicyFailure = {
    code: PasswordRequirementCode;
    message: string;
    values: Record<string, number>;
};

type PasswordStrengthMetrics = {
    length: number;
    numbers: number;
    upperCase: number;
    symbols: number;
    entropy: number;
};

/*
 * https://en.wikipedia.org/wiki/Password_policy
 * password must meet following criteria, to be perfect:
 *  - min <n> chars
 *  - min <n> numbers
 *  - min <n> symbols
 *  - min <n> uppercase chars
 *  - shannon entropy folded into [0, 1] interval
 *
 * Returns a bounded score in the [0, 1] interval.
 */
export function checkPassword(password: string): number {
    return calculatePasswordStrength(password, Config.get().register.password);
}

export function calculatePasswordStrength(password: string, policy: PasswordStrengthPolicy = Config.get().register.password): number {
    const characters = Array.from(password);
    const metrics = getPasswordMetrics(characters);

    return scorePasswordPolicy(metrics, policy, isPasswordBlocklisted(password, policy.blocklist));
}

export function validatePasswordPolicy(password: string, policy: PasswordStrengthPolicy = Config.get().register.password): PasswordPolicyFailure | undefined {
    const characters = Array.from(password);
    const metrics = getPasswordMetrics(characters);

    if (!meetsMinimum(metrics.length, policy.minLength)) {
        const min = normalizedMinimum(policy.minLength);
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_LENGTH",
            message: `The password must be at least ${min} characters long.`,
            values: { min },
        };
    }

    if (!meetsMinimum(metrics.numbers, policy.minNumbers)) {
        const min = normalizedMinimum(policy.minNumbers);
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_NUMBERS",
            message: `The password must contain at least ${min} numbers.`,
            values: { min },
        };
    }

    if (!meetsMinimum(metrics.upperCase, policy.minUpperCase)) {
        const min = normalizedMinimum(policy.minUpperCase);
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_UPPERCASE",
            message: `The password must contain at least ${min} uppercase letters.`,
            values: { min },
        };
    }

    if (!meetsMinimum(metrics.symbols, policy.minSymbols)) {
        const min = normalizedMinimum(policy.minSymbols);
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_SYMBOLS",
            message: `The password must contain at least ${min} symbols.`,
            values: { min },
        };
    }

    if (isPasswordBlocklisted(password, policy.blocklist)) {
        return {
            code: "PASSWORD_REQUIREMENTS_BLOCKLIST",
            message: "This password is too common. Please choose a different password.",
            values: {},
        };
    }
}

export function isPasswordBlocklisted(password: string, blocklist: string[] = []): boolean {
    const normalizedPassword = normalizeBlocklistEntry(password);
    return blocklist.some((entry) => {
        const normalizedEntry = normalizeBlocklistEntry(entry);
        return normalizedEntry !== "" && normalizedEntry === normalizedPassword;
    });
}

function normalizeBlocklistEntry(value: string): string {
    return value.normalize("NFKC").trim().toLowerCase();
}

function meetsMinimum(value: number, minimum: number): boolean {
    return value >= normalizedMinimum(minimum);
}

function normalizedMinimum(minimum: number): number {
    return Number.isFinite(minimum) ? Math.max(0, minimum) : 0;
}

function getPasswordMetrics(characters: string[]): PasswordStrengthMetrics {
    return {
        length: characters.length,
        numbers: characters.filter((character) => reNUMBER.test(character)).length,
        upperCase: characters.filter((character) => reUPPERCASELETTER.test(character)).length,
        symbols: characters.filter(isSymbol).length,
        entropy: calculateNormalizedShannonEntropy(characters),
    };
}

function isSymbol(character: string): boolean {
    return !reLETTER_OR_NUMBER.test(character);
}

function scorePasswordPolicy(metrics: PasswordStrengthMetrics, policy: PasswordStrengthPolicy, blocklisted: boolean): number {
    if (metrics.length <= 1 || blocklisted) return 0;

    let strength = 0;
    if (meetsMinimum(metrics.length, policy.minLength)) strength += PASSWORD_REQUIREMENT_SCORE;
    if (meetsMinimum(metrics.numbers, policy.minNumbers)) strength += PASSWORD_REQUIREMENT_SCORE;
    if (meetsMinimum(metrics.upperCase, policy.minUpperCase)) strength += PASSWORD_REQUIREMENT_SCORE;
    if (meetsMinimum(metrics.symbols, policy.minSymbols)) strength += PASSWORD_REQUIREMENT_SCORE;

    strength += metrics.entropy * ENTROPY_SCORE_WEIGHT;
    return clamp(strength, 0, 1);
}

function calculateNormalizedShannonEntropy(characters: string[]): number {
    if (characters.length <= 1) return 0;

    const counts = new Map<string, number>();
    for (const character of characters) counts.set(character, (counts.get(character) ?? 0) + 1);

    let entropy = 0;
    for (const count of counts.values()) {
        const probability = count / characters.length;
        entropy -= probability * Math.log2(probability);
    }

    return entropy / Math.log2(characters.length);
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

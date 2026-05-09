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

import { Config } from "@spacebar/util";

const reNUMBER = /[0-9]/g;
const reUPPERCASELETTER = /[A-Z]/g;
const reNON_SYMBOL = /[A-Za-z0-9]/g;

type PasswordPolicy = {
    minLength: number;
    minNumbers: number;
    minUpperCase: number;
    minSymbols: number;
};

export type PasswordPolicyFailure = {
    code: "PASSWORD_REQUIREMENTS_MIN_LENGTH" | "PASSWORD_REQUIREMENTS_MIN_NUMBERS" | "PASSWORD_REQUIREMENTS_MIN_UPPERCASE" | "PASSWORD_REQUIREMENTS_MIN_SYMBOLS";
    message: string;
    values: Record<string, number>;
};

function countMatches(password: string, expression: RegExp) {
    return password.match(expression)?.length ?? 0;
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy = Config.get().register.password): PasswordPolicyFailure | undefined {
    if (password.length < policy.minLength) {
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_LENGTH",
            message: `The password must be at least ${policy.minLength} characters long.`,
            values: { min: policy.minLength },
        };
    }

    const numbers = countMatches(password, reNUMBER);
    if (numbers < policy.minNumbers) {
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_NUMBERS",
            message: `The password must contain at least ${policy.minNumbers} numbers.`,
            values: { min: policy.minNumbers },
        };
    }

    const uppercase = countMatches(password, reUPPERCASELETTER);
    if (uppercase < policy.minUpperCase) {
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_UPPERCASE",
            message: `The password must contain at least ${policy.minUpperCase} uppercase letters.`,
            values: { min: policy.minUpperCase },
        };
    }

    const symbols = password.replace(reNON_SYMBOL, "").length;
    if (symbols < policy.minSymbols) {
        return {
            code: "PASSWORD_REQUIREMENTS_MIN_SYMBOLS",
            message: `The password must contain at least ${policy.minSymbols} symbols.`,
            values: { min: policy.minSymbols },
        };
    }
}

// const blocklist: string[] = []; // TODO: update ones passwordblocklist is stored in db
/*
 * https://en.wikipedia.org/wiki/Password_policy
 * password must meet following criteria, to be perfect:
 *  - min <n> chars
 *  - min <n> numbers
 *  - min <n> symbols
 *  - min <n> uppercase chars
 *  - shannon entropy folded into [0, 1) interval
 *
 * Returns: 0 > pw > 1
 */
export function checkPassword(password: string): number {
    if (password.length <= 1) return 0;

    const policy = Config.get().register.password;
    let strength = 0;

    // checks for total password len
    if (password.length >= policy.minLength) {
        strength += 0.05;
    }

    // checks for amount of Numbers
    if (countMatches(password, reNUMBER) >= policy.minNumbers) {
        strength += 0.05;
    }

    // checks for amount of Uppercase Letters
    if (countMatches(password, reUPPERCASELETTER) >= policy.minUpperCase) {
        strength += 0.05;
    }

    // checks for amount of symbols
    if (password.replace(reNON_SYMBOL, "").length >= policy.minSymbols) {
        strength += 0.05;
    }

    // checks if password only consists of numbers or only consists of chars
    if (password.length === countMatches(password, reNUMBER) || password.length === countMatches(password, reUPPERCASELETTER)) {
        strength = 0;
    }

    const entropyMap: { [key: string]: number } = {};
    for (let i = 0; i < password.length; i++) {
        if (entropyMap[password[i]]) entropyMap[password[i]]++;
        else entropyMap[password[i]] = 1;
    }

    const entropies = Object.values(entropyMap);

    const entropy = entropies.reduce((sum: number, count: number) => {
        const probability = count / password.length;
        return sum - probability * Math.log2(probability);
    }, 0);
    strength += entropy / Math.log2(password.length);
    return strength;
}

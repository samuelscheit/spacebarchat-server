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

import { DiscordApiErrors, Invite } from "@spacebar/util";
import crypto from "node:crypto";

const INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const INVITE_CODE_LENGTH = 8;
export const RANDOM_INVITE_ATTEMPTS = 5;
export const INVITE_CODE_MAX_LENGTH = 20;
export const INVITE_CODE_REGEX = new RegExp(`^[A-Za-z0-9]{1,${INVITE_CODE_MAX_LENGTH}}$`);

export type InviteCodeRepository = {
    findOne: (options: { where: { code: string }; select?: { code: true } }) => Promise<unknown>;
};

export interface GenerateUnusedInviteCodeOptions {
    inviteRepository?: InviteCodeRepository;
    generateCode?: () => string;
    attempts?: number;
}

export function randomString(length = 6) {
    if (!Number.isSafeInteger(length) || length <= 0) {
        throw new RangeError("length must be a positive safe integer");
    }

    let str = "";
    for (let i = 0; i < length; i++) {
        // crypto.randomInt performs rejection sampling, so the base62 alphabet is
        // selected without modulo bias.
        str += INVITE_CODE_CHARS.charAt(crypto.randomInt(INVITE_CODE_CHARS.length));
    }

    return str;
}

export function validateInviteCode(code: unknown) {
    if (typeof code !== "string" || !INVITE_CODE_REGEX.test(code)) {
        throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
    }

    return code;
}

export async function generateUnusedInviteCode(options: GenerateUnusedInviteCodeOptions = {}) {
    const inviteRepository = options.inviteRepository ?? (Invite as unknown as InviteCodeRepository);
    const generateCode = options.generateCode ?? (() => randomString(INVITE_CODE_LENGTH));
    const attempts = options.attempts ?? RANDOM_INVITE_ATTEMPTS;
    if (!Number.isSafeInteger(attempts) || attempts <= 0) {
        throw new RangeError("attempts must be a positive safe integer");
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
        const code = validateInviteCode(generateCode());
        if (!(await inviteRepository.findOne({ where: { code }, select: { code: true } }))) return code;
    }

    throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
}

export { randomUpperString } from "@spacebar/util";

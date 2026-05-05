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

import { DiscordApiErrors, Invite, User } from "@spacebar/util";
import { randomString } from "./RandomInviteID";

export interface UserInviteCreateBody {
    code?: string;
}

type InviteRecord = {
    toJSON?: () => Record<string, unknown>;
};

type UnsavedInvite = InviteRecord & {
    save: () => Promise<InviteRecord>;
};

type InviteRepository = {
    findOne: (options: { where: { code: string }; select?: { code: true } }) => Promise<unknown>;
    create: (invite: Partial<Invite>) => UnsavedInvite;
};

export interface CreateUserInviteOptions {
    inviteRepository?: InviteRepository;
    getPublicUser?: (user_id: string) => Promise<unknown>;
    generateCode?: () => string;
    now?: () => Date;
}

const RANDOM_INVITE_ATTEMPTS = 5;

export async function createUserInvite(user_id: string, body: UserInviteCreateBody, options: CreateUserInviteOptions = {}): Promise<Record<string, unknown>> {
    const inviteRepository = options.inviteRepository ?? (Invite as unknown as InviteRepository);
    const getPublicUser = options.getPublicUser ?? User.getPublicUser;
    const generateCode = options.generateCode ?? randomString;
    const now = options.now ?? (() => new Date());

    const code = body.code ?? (await createUnusedInviteCode(inviteRepository, generateCode));

    if (body.code && (await inviteRepository.findOne({ where: { code: body.code }, select: { code: true } }))) {
        throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
    }

    const invite = await inviteRepository
        .create({
            code,
            temporary: false,
            uses: 0,
            max_uses: 0,
            max_age: 0,
            created_at: now(),
            inviter_id: user_id,
            flags: 0,
        })
        .save();

    const data = invite.toJSON ? invite.toJSON() : { ...invite };
    data.inviter = await getPublicUser(user_id);
    return data;
}

async function createUnusedInviteCode(inviteRepository: InviteRepository, generateCode: () => string): Promise<string> {
    for (let attempt = 0; attempt < RANDOM_INVITE_ATTEMPTS; attempt++) {
        const code = generateCode();
        if (!(await inviteRepository.findOne({ where: { code }, select: { code: true } }))) return code;
    }

    throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
}

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

import { RelationshipType, UserInviteResponse } from "@spacebar/schemas";
import { Config, DiscordApiErrors, Invite, User } from "@spacebar/util";
import { randomString } from "./RandomInviteID";
import { UpdateRelationshipOptions, relationshipUserProjection, updateRelationship } from "./Relationships";

export interface UserInviteCreateBody {
    code?: string;
}

type InviteRecord = {
    toJSON?: () => object;
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
    getPublicUser?: (user_id: string) => Promise<UserInviteResponse["inviter"]>;
    generateCode?: () => string;
    now?: () => Date;
}

export interface AcceptUserInviteOptions {
    deleteInvite?: (criteria: { code: string }) => Promise<unknown>;
    getPublicUser?: (user_id: string) => Promise<UserInviteResponse["inviter"]>;
    getRelationshipUser?: (user_id: string) => Promise<User>;
    getMaxFriends?: () => number;
    updateRelationship?: (user_id: string, friend: User, type: RelationshipType, options?: UpdateRelationshipOptions) => Promise<void>;
}

export interface RevokeUserInviteOptions {
    deleteInvite?: (criteria: { code: string }) => Promise<unknown>;
}

const RANDOM_INVITE_ATTEMPTS = 5;
export const USER_INVITE_TYPE = 2;
export const USER_INVITE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const USER_INVITE_MAX_USES = 5;
export const USER_INVITE_CODE_MAX_LENGTH = 20;
export const USER_INVITE_CODE_REGEX = new RegExp(`^[A-Za-z0-9]{1,${USER_INVITE_CODE_MAX_LENGTH}}$`);

export function isUserInvite(
    invite: Pick<Invite, "guild_id" | "channel_id" | "inviter_id">,
): invite is Pick<Invite, "guild_id" | "channel_id" | "inviter_id"> & { inviter_id: string } {
    return !invite.guild_id && !invite.channel_id && !!invite.inviter_id;
}

export async function createUserInvite(user_id: string, body: UserInviteCreateBody, options: CreateUserInviteOptions = {}): Promise<UserInviteResponse> {
    const inviteRepository = options.inviteRepository ?? (Invite as unknown as InviteRepository);
    const getPublicUser = options.getPublicUser ?? User.getPublicUser;
    const generateCode = options.generateCode ?? randomString;
    const now = options.now ?? (() => new Date());

    const createdAt = now();
    const code = body.code === undefined ? await createUnusedInviteCode(inviteRepository, generateCode) : validateUserInviteCode(body.code);

    if (body.code !== undefined && (await inviteRepository.findOne({ where: { code }, select: { code: true } }))) {
        throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
    }

    const invite = await inviteRepository
        .create({
            code,
            temporary: false,
            uses: 0,
            max_uses: USER_INVITE_MAX_USES,
            max_age: USER_INVITE_MAX_AGE_SECONDS,
            created_at: createdAt,
            expires_at: new Date(createdAt.getTime() + USER_INVITE_MAX_AGE_SECONDS * 1000),
            inviter_id: user_id,
            flags: 0,
        })
        .save();

    return toUserInviteResponse(invite, await getPublicUser(user_id));
}

export async function acceptUserInvite(user_id: string, invite: Invite, options: AcceptUserInviteOptions = {}): Promise<UserInviteResponse> {
    if (!isUserInvite(invite)) throw DiscordApiErrors.UNKNOWN_INVITE;

    const deleteInvite = options.deleteInvite ?? Invite.delete.bind(Invite);
    const getPublicUser = options.getPublicUser ?? User.getPublicUser;
    const getMaxFriends = options.getMaxFriends ?? (() => Config.get().limits.user.maxFriends);
    const getRelationshipUser =
        options.getRelationshipUser ??
        ((friend_id: string) =>
            User.findOneOrFail({
                where: { id: friend_id },
                relations: { relationships: { to: true } },
                select: relationshipUserProjection,
            }));
    const updateUserRelationship = options.updateRelationship ?? updateRelationship;

    if (invite.isExpired()) {
        await deleteInvite({ code: invite.code });
        throw DiscordApiErrors.UNKNOWN_INVITE;
    }

    const inviter = await getRelationshipUser(invite.inviter_id);
    const existingInviterRelationship = inviter.relationships.find((x) => x.to_id === user_id);
    const maxFriends = getMaxFriends();
    if (!existingInviterRelationship && inviter.relationships.length >= maxFriends) throw DiscordApiErrors.MAXIMUM_FRIENDS.withParams(maxFriends);

    await updateUserRelationship(user_id, inviter, RelationshipType.friends, { directFriendship: true });

    invite.uses++;
    if (invite.max_uses !== 0 && invite.uses >= invite.max_uses) await deleteInvite({ code: invite.code });
    else await invite.save();

    return toUserInviteResponse(invite, await getPublicUser(invite.inviter_id));
}

export async function revokeUserInvite(user_id: string, invite: Invite, options: RevokeUserInviteOptions = {}): Promise<void> {
    if (!isUserInvite(invite) || invite.inviter_id !== user_id) throw DiscordApiErrors.UNKNOWN_INVITE;

    const deleteInvite = options.deleteInvite ?? Invite.delete.bind(Invite);
    await deleteInvite({ code: invite.code });
}

function validateUserInviteCode(code: unknown): string {
    if (typeof code !== "string" || !USER_INVITE_CODE_REGEX.test(code)) {
        throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
    }

    return code;
}

export function toUserInviteResponse(invite: InviteRecord, inviter: UserInviteResponse["inviter"]): UserInviteResponse {
    const data = (invite.toJSON ? invite.toJSON() : { ...invite }) as Record<string, unknown>;
    return {
        type: USER_INVITE_TYPE,
        code: data.code as string,
        temporary: data.temporary as boolean,
        uses: data.uses as number,
        max_uses: data.max_uses as number,
        max_age: data.max_age as number,
        created_at: data.created_at as Date,
        expires_at: data.expires_at as Date,
        inviter_id: data.inviter_id as string | undefined,
        inviter,
        flags: data.flags as number,
    };
}

async function createUnusedInviteCode(inviteRepository: InviteRepository, generateCode: () => string): Promise<string> {
    for (let attempt = 0; attempt < RANDOM_INVITE_ATTEMPTS; attempt++) {
        const code = generateCode();
        validateUserInviteCode(code);
        if (!(await inviteRepository.findOne({ where: { code }, select: { code: true } }))) return code;
    }

    throw DiscordApiErrors.INVALID_OR_TAKEN_INVITE_CODE;
}

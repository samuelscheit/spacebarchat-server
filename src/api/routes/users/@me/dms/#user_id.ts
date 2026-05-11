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

import { route } from "@spacebar/api";
import { ChannelType } from "@spacebar/schemas";
import { ApiError, Channel, DiscordApiErrors, DmChannelDTO, Recipient, User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const DM_CHANNELS_READ_SCOPE = "dm_channels.read";

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
};

export type ExistingDmRecipient = Pick<Recipient, "closed" | "user_id">;
export type ExistingDmChannel = Pick<Channel, "created_at" | "id" | "type"> & {
    recipients?: ExistingDmRecipient[] | null;
};
export type CurrentUserRecipient = {
    channel: ExistingDmChannel;
};

export const UNKNOWN_DM_CHANNEL = new ApiError(DiscordApiErrors.UNKNOWN_CHANNEL.message, DiscordApiErrors.UNKNOWN_CHANNEL.code, 404);
export const UNKNOWN_DM_USER = new ApiError(DiscordApiErrors.UNKNOWN_USER.message, DiscordApiErrors.UNKNOWN_USER.code, 404);

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

export function hasOAuthScopeClaims(token: unknown): token is OAuthScopeToken {
    return !!token && typeof token === "object" && ("scope" in token || "scopes" in token || "scp" in token);
}

export function hasOAuthScope(token: unknown, requiredScope = DM_CHANNELS_READ_SCOPE): boolean {
    if (!hasOAuthScopeClaims(token)) return false;

    return [...scopeValues(token.scope), ...scopeValues(token.scopes), ...scopeValues(token.scp)].includes(requiredScope);
}

export function assertDmChannelsReadScopeForOAuthToken(token: unknown): void {
    if (hasOAuthScopeClaims(token) && !hasOAuthScope(token)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
}

function isSameParticipantSet(recipients: readonly ExistingDmRecipient[] | undefined | null, participantIds: Set<string>) {
    if (!recipients || recipients.length !== participantIds.size) return false;

    return recipients.every((recipient) => participantIds.has(recipient.user_id));
}

export function selectExistingCurrentUserDmChannel(recipients: readonly CurrentUserRecipient[], currentUserId: string, targetUserId: string): ExistingDmChannel | undefined {
    const participantIds = new Set([currentUserId, targetUserId]);
    const channels = recipients
        .map((recipient) => recipient.channel)
        .filter((channel) => channel.type === ChannelType.DM && isSameParticipantSet(channel.recipients, participantIds))
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime());

    return channels[0];
}

async function assertTargetUserExists(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) return;

    const user = await User.findOne({
        where: { id: targetUserId },
        select: { id: true },
    });
    if (!user) throw UNKNOWN_DM_USER;
}

export async function getExistingCurrentUserDmChannel(currentUserId: string, targetUserId: string) {
    await assertTargetUserExists(currentUserId, targetUserId);

    const currentUserRecipients = await Recipient.find({
        where: { user_id: currentUserId, closed: false },
        relations: { channel: { recipients: true } },
    });
    const channel = selectExistingCurrentUserDmChannel(currentUserRecipients as CurrentUserRecipient[], currentUserId, targetUserId);
    if (!channel) throw UNKNOWN_DM_CHANNEL;

    return DmChannelDTO.from(channel as Channel, [currentUserId]);
}

router.get(
    "/",
    route({
        summary: "Get DM Channel",
        responses: {
            200: {
                body: "DmChannelDTO",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        assertDmChannelsReadScopeForOAuthToken(req.token);

        const { user_id } = req.params as { [key: string]: string };
        return res.json(await getExistingCurrentUserDmChannel(req.user_id, user_id));
    },
);

export default router;

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
import { ChannelType, type PartnerSdkUserMessageSummariesResponse, type PartnerSdkUserMessageSummaryResponse } from "@spacebar/schemas";
import { DiscordApiErrors, Recipient, type Channel } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const DM_CHANNELS_READ_SCOPE = "dm_channels.read";
const partnerSdkUserMessageSummaryChannelTypes = new Set<ChannelType>([ChannelType.DM, ChannelType.EPHEMERAL_DM]);

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
};

export type PartnerSdkUserMessageSummaryRecipient = Pick<Recipient, "closed" | "user_id">;
export type PartnerSdkUserMessageSummaryChannel = Pick<Channel, "last_message_id" | "type"> & {
    recipients?: PartnerSdkUserMessageSummaryRecipient[] | null;
};
export type PartnerSdkCurrentUserMessageSummaryRecipient = {
    channel?: PartnerSdkUserMessageSummaryChannel | null;
};

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

function compareSnowflakeDescending(left: string, right: string): number {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const leftValue = BigInt(left);
        const rightValue = BigInt(right);
        if (leftValue > rightValue) return -1;
        if (leftValue < rightValue) return 1;
        return 0;
    }

    return right.localeCompare(left);
}

export function getPartnerSdkUserMessageSummaryRecipientId(channel: PartnerSdkUserMessageSummaryChannel, currentUserId: string): string | undefined {
    if (!partnerSdkUserMessageSummaryChannelTypes.has(channel.type)) return undefined;

    const recipientIds = [...new Set((channel.recipients ?? []).map((recipient) => recipient.user_id).filter((userId) => userId !== currentUserId))];
    return recipientIds.length === 1 ? recipientIds[0] : undefined;
}

export function serializePartnerSdkUserMessageSummaries(
    recipients: readonly PartnerSdkCurrentUserMessageSummaryRecipient[],
    currentUserId: string,
): PartnerSdkUserMessageSummariesResponse {
    const summaries: PartnerSdkUserMessageSummaryResponse[] = [];

    for (const recipient of recipients) {
        const channel = recipient.channel;
        const lastMessageId = channel?.last_message_id;
        if (!channel || !lastMessageId) continue;

        const userId = getPartnerSdkUserMessageSummaryRecipientId(channel, currentUserId);
        if (!userId) continue;

        summaries.push({
            user_id: userId,
            last_message_id: lastMessageId,
        });
    }

    return summaries.sort((left, right) => compareSnowflakeDescending(left.last_message_id, right.last_message_id));
}

export async function getPartnerSdkUserMessageSummaries(currentUserId: string): Promise<PartnerSdkUserMessageSummariesResponse> {
    const recipients = await Recipient.find({
        where: { user_id: currentUserId, closed: false },
        relations: { channel: { recipients: true } },
    });

    return serializePartnerSdkUserMessageSummaries(recipients, currentUserId);
}

router.get(
    "/",
    route({
        summary: "Get User Message Summaries",
        description: "Returns locally backed last-message summaries for the current user's one-to-one DM channels.",
        responses: {
            200: {
                body: "PartnerSdkUserMessageSummariesResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        assertDmChannelsReadScopeForOAuthToken(req.token);

        return res.json(await getPartnerSdkUserMessageSummaries(req.user_id));
    },
);

export default router;

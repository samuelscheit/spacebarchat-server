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

import { route } from "@spacebar/api";
import { Channel, ConnectedAccount, DiscordApiErrors } from "@spacebar/util";
import { ChannelType, type ChannelLinkedAccountsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { In, Not } from "typeorm";

const router: Router = Router({ mergeParams: true });

const DM_CHANNELS_READ_SCOPE = "dm_channels.read";

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
};

type LinkedAccountSource = Pick<ConnectedAccount, "external_id" | "name" | "user_id">;
type GroupDmRecipient = { user_id: string; closed?: boolean | null };
type GroupDmChannel = Pick<Channel, "type" | "recipients"> & { recipients?: GroupDmRecipient[] };

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

export function hasOAuthScope(token: unknown, requiredScope = DM_CHANNELS_READ_SCOPE): boolean {
    if (!token || typeof token !== "object") return false;

    const scopeToken = token as OAuthScopeToken;
    return [...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)].includes(requiredScope);
}

export function assertDmChannelsReadScope(token: unknown): void {
    if (!hasOAuthScope(token)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
}

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseLinkedAccountUserIds(query: Request["query"]): string[] {
    return [...new Set([...queryValues(query.user_ids), ...queryValues(query["user_ids[]"])])];
}

export function resolveLinkedAccountUserIds(channel: GroupDmChannel, requesterId: string, requestedUserIds: string[]): string[] {
    if (channel.type !== ChannelType.GROUP_DM) throw DiscordApiErrors.CANNOT_EXECUTE_ON_THIS_CHANNEL_TYPE;

    const activeRecipientIds = new Set((channel.recipients ?? []).filter((recipient) => recipient.closed === false).map((recipient) => recipient.user_id));
    if (!activeRecipientIds.has(requesterId)) throw DiscordApiErrors.MISSING_PERMISSIONS;

    const userIds = requestedUserIds.length ? requestedUserIds : [...activeRecipientIds];
    return [...new Set(userIds.filter((userId) => activeRecipientIds.has(userId)))];
}

export function serializeChannelLinkedAccounts(userIds: string[], accounts: LinkedAccountSource[]): ChannelLinkedAccountsResponse {
    const linked_accounts: ChannelLinkedAccountsResponse["linked_accounts"] = Object.fromEntries(userIds.map((userId) => [userId, []]));

    for (const account of accounts) {
        const userAccounts = linked_accounts[account.user_id];
        if (!userAccounts) continue;

        userAccounts.push({
            id: account.external_id,
            name: account.name,
        });
    }

    return { linked_accounts };
}

router.get(
    "/",
    route({
        query: {
            user_ids: {
                type: "array",
                description: "User IDs to get linked accounts for",
            },
        },
        responses: {
            200: {
                body: "ChannelLinkedAccountsResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        assertDmChannelsReadScope(req.token);

        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
            relations: { recipients: true },
        });
        const userIds = resolveLinkedAccountUserIds(channel, req.user_id, parseLinkedAccountUserIds(req.query));

        if (!userIds.length) return res.json({ linked_accounts: {} } satisfies ChannelLinkedAccountsResponse);

        const accounts = await ConnectedAccount.find({
            where: {
                user_id: In(userIds),
                revoked: false,
                visibility: Not(0),
            },
            select: {
                external_id: true,
                name: true,
                user_id: true,
            },
            order: {
                user_id: "ASC",
                type: "ASC",
                external_id: "ASC",
            },
        });

        return res.json(serializeChannelLinkedAccounts(userIds, accounts));
    },
);

export default router;

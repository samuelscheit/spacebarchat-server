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
import type { MessageExplicitMediaScanSchema } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, getPermission, Message } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

type ExplicitMediaScanMessage = Pick<Message, "id" | "channel_id" | "guild_id" | "author_id">;

function uniqueRequestedMessages(body: MessageExplicitMediaScanSchema) {
    const seen = new Set<string>();
    const messages: MessageExplicitMediaScanSchema["messages"] = [];

    for (const message of body.messages) {
        const key = `${message.channel_id}:${message.message_id}`;
        if (seen.has(key)) continue;

        seen.add(key);
        messages.push(message);
    }

    return messages;
}

async function getExistingScanMessages(body: MessageExplicitMediaScanSchema): Promise<ExplicitMediaScanMessage[]> {
    const requestedMessages = uniqueRequestedMessages(body);

    return (await Message.find({
        where: requestedMessages.map((message) => ({
            id: message.message_id,
            channel_id: message.channel_id,
        })),
        select: {
            id: true,
            channel_id: true,
            guild_id: true,
            author_id: true,
        },
    })) as ExplicitMediaScanMessage[];
}

function isIgnorableAccessError(error: unknown) {
    return error instanceof ApiError && [DiscordApiErrors.MISSING_PERMISSIONS.code, DiscordApiErrors.UNKNOWN_CHANNEL.code, DiscordApiErrors.UNKNOWN_MESSAGE.code].includes(error.code);
}

async function resolveAccessibleScanTargets(userId: string, body: MessageExplicitMediaScanSchema): Promise<ExplicitMediaScanMessage[]> {
    const permissionCache = new Map<string, Awaited<ReturnType<typeof getPermission>>>();
    const accessibleMessages: ExplicitMediaScanMessage[] = [];

    for (const message of await getExistingScanMessages(body)) {
        try {
            const permissionCacheKey = `${message.guild_id ?? ""}:${message.channel_id}`;
            let permissions = permissionCache.get(permissionCacheKey);
            if (!permissions) {
                permissions = await getPermission(userId, message.guild_id, message.channel_id);
                permissionCache.set(permissionCacheKey, permissions);
            }

            permissions.hasThrow("VIEW_CHANNEL");
            if (message.author_id !== userId) permissions.hasThrow("READ_MESSAGE_HISTORY");
            accessibleMessages.push(message);
        } catch (error) {
            if (!isIgnorableAccessError(error)) throw error;
        }
    }

    return accessibleMessages;
}

router.patch(
    "/",
    route({
        requestBody: "MessageExplicitMediaScanSchema",
        coerceRequestBody: false,
        summary: "Bulk Scan Explicit Media",
        description:
            "Accepts a bulk explicit-media scan request for locally visible messages without fabricating scan results when no explicit-media scanner is configured.",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        await resolveAccessibleScanTargets(req.user_id, req.body as MessageExplicitMediaScanSchema);

        // Spacebar does not currently persist explicit-media scan versions or
        // scanner findings. Validate request shape and visibility, then accept
        // the compatibility signal without mutating message state.
        return res.status(204).send();
    },
);

export default router;

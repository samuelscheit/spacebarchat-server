/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors
	
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

import { getChannelIdSetWithPermissions, preloadAuthorizedMessages, route, toPreloadMessageResponse } from "@spacebar/api";
import { Config, Message, messagePublicRelations } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { PreloadMessagesRequestSchema, type PreloadMessagesResponse } from "@spacebar/schemas";

export interface PreloadMessagesRouteDependencies {
    getAuthorizedChannelIds?(userId: string | undefined, channelIds: string[]): Promise<Set<string>>;
    findLatestMessage?(channelId: string): Promise<Message | null>;
    getMaxPreloadCount?(): number;
    serializeMessage?(message: Message): PreloadMessagesResponse[number];
}

const defaultPreloadMessagesRouteDependencies: Required<PreloadMessagesRouteDependencies> = {
    getAuthorizedChannelIds: (userId, channelIds) =>
        getChannelIdSetWithPermissions(userId, channelIds, {
            requiredPermissions: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
        }),
    findLatestMessage: (channelId) =>
        Message.findOne({
            where: { channel_id: channelId },
            order: { timestamp: "DESC" },
            relations: messagePublicRelations,
        }),
    getMaxPreloadCount: () => Config.get().limits.message.maxPreloadCount,
    serializeMessage: toPreloadMessageResponse,
};

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parsePreloadMessageChannelIdsQuery(query: Request["query"]): string[] {
    return [...queryValues(query.channel_ids), ...queryValues(query["channel_ids[]"])];
}

export function getPreloadMessageChannelIdsFromBody(body: PreloadMessagesRequestSchema): string[] {
    body.channels ??= body.channel_ids ?? [];
    return body.channels;
}

export async function getPreloadMessagesResponse(
    userId: string | undefined,
    channelIds: string[],
    dependencies: PreloadMessagesRouteDependencies = {},
): Promise<PreloadMessagesResponse> {
    const resolvedDependencies = {
        ...defaultPreloadMessagesRouteDependencies,
        ...dependencies,
    };

    return preloadAuthorizedMessages<Message, PreloadMessagesResponse[number]>(channelIds, {
        getAuthorizedChannelIds: (requestedChannelIds) => resolvedDependencies.getAuthorizedChannelIds(userId, requestedChannelIds),
        findLatestMessage: resolvedDependencies.findLatestMessage,
        serializeMessage: resolvedDependencies.serializeMessage,
    });
}

function maxPreloadCountError(maxPreloadCount: number) {
    return {
        code: 400,
        message: `Cannot preload more than ${maxPreloadCount} channels at once.`,
    };
}

async function sendPreloadedMessages(req: Request, res: Response, channelIds: string[], dependencies: PreloadMessagesRouteDependencies) {
    const maxPreloadCount = dependencies.getMaxPreloadCount?.() ?? defaultPreloadMessagesRouteDependencies.getMaxPreloadCount();
    if (channelIds.length > maxPreloadCount) return res.status(400).send(maxPreloadCountError(maxPreloadCount));

    const filteredMessages = await getPreloadMessagesResponse(req.user_id, channelIds, dependencies);
    return res.status(200).send(filteredMessages);
}

export function createPreloadMessagesRouter(dependencies: PreloadMessagesRouteDependencies = {}) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Preload Messages",
            description: "Preloads the latest locally backed message from each requested channel ID query parameter without including reactions.",
            query: {
                channel_ids: {
                    type: "array",
                    description: "Channel IDs to preload messages from.",
                },
            },
            responses: {
                200: {
                    body: "PreloadMessagesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => sendPreloadedMessages(req, res, parsePreloadMessageChannelIdsQuery(req.query), dependencies),
    );

    router.post(
        "/",
        route({
            requestBody: "PreloadMessagesRequestSchema",
            responses: {
                200: {
                    body: "PreloadMessagesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => sendPreloadedMessages(req, res, getPreloadMessageChannelIdsFromBody(req.body as PreloadMessagesRequestSchema), dependencies),
    );

    router.put(
        "/",
        route({
            summary: "Preload Messages",
            description: "Preloads the latest locally backed message from each requested channel ID JSON body without including reactions.",
            requestBody: "PreloadMessagesRequestSchema",
            responses: {
                200: {
                    body: "PreloadMessagesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => sendPreloadedMessages(req, res, getPreloadMessageChannelIdsFromBody(req.body as PreloadMessagesRequestSchema), dependencies),
    );

    router.delete(
        "/",
        route({
            summary: "Delete Preloaded Message Previews",
            description: "Acknowledges deletion of preloaded message preview cache state. Spacebar does not persist message preview cache rows locally.",
            responses: {
                204: {},
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (_req: Request, res: Response) => res.sendStatus(204),
    );

    return router;
}

export default createPreloadMessagesRouter();

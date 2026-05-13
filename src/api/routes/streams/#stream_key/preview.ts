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

import { createMessageUpload, route } from "@spacebar/api";
import { ChannelType, type StreamPreviewUploadSchema } from "@spacebar/schemas";
import { ApiError, Channel, DiscordApiErrors, getPermission, Stream, type Permissions } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";

export const UNKNOWN_STREAM = new ApiError(DiscordApiErrors.UNKNOWN_STREAM.message, DiscordApiErrors.UNKNOWN_STREAM.code, 404);

type StreamKey = {
    type: "guild" | "call";
    channelId: string;
    guildId?: string;
    userId: string;
};

type StreamPreviewChannel = Pick<Channel, "id" | "guild_id" | "type">;
type StreamPreviewRecord = Pick<Stream, "id" | "channel_id" | "owner_id">;
type PermissionGuard = Pick<Permissions, "hasThrow">;
export type StreamPreviewVideoUploadFile = Pick<Express.Multer.File, "buffer" | "mimetype" | "originalname" | "size">;
export type StreamPreviewUploadTarget = {
    streamKey: StreamKey;
    channel: StreamPreviewChannel;
    stream: StreamPreviewRecord;
    userId: string;
    thumbnail: string;
};
export type StreamPreviewVideoUploadTarget = Omit<StreamPreviewUploadTarget, "thumbnail"> & {
    file: StreamPreviewVideoUploadFile;
};

export interface StreamPreviewDependencies {
    findChannel(options: FindOneOptions<Channel>): Promise<StreamPreviewChannel | null>;
    findStream(channelId: string, ownerId: string): Promise<StreamPreviewRecord | null>;
    getPermission(userId: string, guildId: string | undefined, channelId: string): Promise<PermissionGuard>;
    uploadPreview?(target: StreamPreviewUploadTarget): Promise<void>;
    uploadPreviewVideo?(target: StreamPreviewVideoUploadTarget): Promise<void>;
}

const defaultDependencies: StreamPreviewDependencies = {
    findChannel: (options) => Channel.findOne(options) as Promise<StreamPreviewChannel | null>,
    findStream: (channelId, ownerId) => Stream.findOne({ where: { channel_id: channelId, owner_id: ownerId } }) as Promise<StreamPreviewRecord | null>,
    getPermission,
    uploadPreview: async () => {
        throw new HTTPError("Stream preview image uploads are not supported", 501);
    },
    uploadPreviewVideo: async () => {
        throw new HTTPError("Stream preview video uploads are not supported", 501);
    },
};

const streamPreviewVideoUpload = createMessageUpload({ files: 1 }).single("file");

export function parseStreamKey(streamKey: string): StreamKey {
    const streamKeyParts = streamKey.split(":");
    const type = streamKeyParts.shift();

    if (type !== "guild" && type !== "call") throw UNKNOWN_STREAM;
    if ((type === "guild" && streamKeyParts.length !== 3) || (type === "call" && streamKeyParts.length !== 2)) throw UNKNOWN_STREAM;

    const guildId = type === "guild" ? streamKeyParts.shift() : undefined;
    const channelId = streamKeyParts.shift();
    const userId = streamKeyParts.shift();

    if (!channelId || !userId) throw UNKNOWN_STREAM;

    return { type, channelId, guildId, userId };
}

function channelSupportsStreams(channel: Pick<StreamPreviewChannel, "type">): boolean {
    return [ChannelType.GUILD_VOICE, ChannelType.GUILD_STAGE_VOICE, ChannelType.DM, ChannelType.GROUP_DM].includes(channel.type);
}

function assertStreamKeyMatchesChannel(streamKey: StreamKey, channel: StreamPreviewChannel): void {
    if (!channelSupportsStreams(channel)) throw UNKNOWN_STREAM;

    if (streamKey.type === "guild") {
        if (!streamKey.guildId || channel.guild_id !== streamKey.guildId) throw UNKNOWN_STREAM;
        return;
    }

    if (channel.guild_id !== undefined && channel.guild_id !== null) throw UNKNOWN_STREAM;
}

function isMissingPermissionSubject(error: unknown): boolean {
    return error instanceof Error && error.name === "EntityNotFoundError";
}

async function requireStreamPreviewAccess(userId: string, channel: StreamPreviewChannel, dependencies: StreamPreviewDependencies): Promise<void> {
    try {
        const permission = await dependencies.getPermission(userId, channel.guild_id ?? undefined, channel.id);
        permission.hasThrow("CONNECT");
    } catch (error) {
        if (isMissingPermissionSubject(error)) throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("CONNECT");
        throw error;
    }
}

export async function assertStreamPreviewReadable(streamKeyRaw: string, userId: string, dependencies: StreamPreviewDependencies = defaultDependencies): Promise<void> {
    const streamKey = parseStreamKey(streamKeyRaw);
    const channel = await dependencies.findChannel({
        where: { id: streamKey.channelId },
        select: { id: true, guild_id: true, type: true },
    });
    if (!channel) throw UNKNOWN_STREAM;

    assertStreamKeyMatchesChannel(streamKey, channel);
    await requireStreamPreviewAccess(userId, channel, dependencies);

    const stream = await dependencies.findStream(channel.id, streamKey.userId);
    if (!stream) throw UNKNOWN_STREAM;
}

export async function assertStreamPreviewUploadable(
    streamKeyRaw: string,
    userId: string,
    dependencies: StreamPreviewDependencies = defaultDependencies,
): Promise<Omit<StreamPreviewUploadTarget, "thumbnail">> {
    const streamKey = parseStreamKey(streamKeyRaw);
    if (streamKey.userId !== userId) throw UNKNOWN_STREAM;

    const channel = await dependencies.findChannel({
        where: { id: streamKey.channelId },
        select: { id: true, guild_id: true, type: true },
    });
    if (!channel) throw UNKNOWN_STREAM;

    assertStreamKeyMatchesChannel(streamKey, channel);

    const stream = await dependencies.findStream(channel.id, streamKey.userId);
    if (!stream || stream.owner_id !== userId) throw UNKNOWN_STREAM;

    return { streamKey, channel, stream, userId };
}

export async function uploadStreamPreview(
    streamKeyRaw: string,
    userId: string,
    body: StreamPreviewUploadSchema,
    dependencies: StreamPreviewDependencies = defaultDependencies,
): Promise<void> {
    const target = await assertStreamPreviewUploadable(streamKeyRaw, userId, dependencies);
    const uploadPreview = dependencies.uploadPreview ?? defaultDependencies.uploadPreview!;

    await uploadPreview({ ...target, thumbnail: body.thumbnail });
}

export async function uploadStreamPreviewVideo(
    streamKeyRaw: string,
    userId: string,
    file: StreamPreviewVideoUploadFile | undefined,
    dependencies: StreamPreviewDependencies = defaultDependencies,
): Promise<void> {
    if (!file) throw new HTTPError("missing file", 400);

    const target = await assertStreamPreviewUploadable(streamKeyRaw, userId, dependencies);
    const uploadPreviewVideo = dependencies.uploadPreviewVideo ?? defaultDependencies.uploadPreviewVideo!;

    await uploadPreviewVideo({ ...target, file });
}

export function createStreamPreviewRouter(dependencies: StreamPreviewDependencies = defaultDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Stream Preview",
            description:
                "Checks access to an active stream preview. Spacebar does not currently persist uploaded stream preview images or video metadata, so a readable stream with no local preview source returns no content.",
            responses: {
                204: {},
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
            const { stream_key } = req.params as { [key: string]: string };
            await assertStreamPreviewReadable(stream_key, req.user_id, dependencies);
            return res.sendStatus(204);
        },
    );

    router.post(
        "/",
        route({
            requestBody: "StreamPreviewUploadSchema",
            coerceRequestBody: false,
            summary: "Upload Stream Preview",
            description:
                "Uploads a preview image for an active stream owned by the current user. Spacebar does not currently have a durable local stream preview storage provider, so the default server fails closed with 501 instead of acknowledging a discarded preview.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { stream_key } = req.params as { [key: string]: string };
            await uploadStreamPreview(stream_key, req.user_id, req.body as StreamPreviewUploadSchema, dependencies);
            return res.sendStatus(204);
        },
    );

    router.post(
        "/video",
        streamPreviewVideoUpload,
        route({
            summary: "Upload Video Stream Preview",
            description:
                "Uploads a preview video for an active stream owned by the current user. Spacebar does not currently have a durable local stream preview video storage provider, so the default server fails closed with 501 instead of acknowledging discarded media.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { stream_key } = req.params as { [key: string]: string };
            await uploadStreamPreviewVideo(stream_key, req.user_id, req.file, dependencies);
            return res.sendStatus(204);
        },
    );

    return router;
}

export default createStreamPreviewRouter();

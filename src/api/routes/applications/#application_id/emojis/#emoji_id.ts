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
import type { ApplicationEmojiModifySchema, PartialUser } from "@spacebar/schemas";
import { ApplicationEmoji, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import type { EmojiResponse } from "../../../../../schemas/api/guilds/Emoji";
import { requireApplicationEmojiAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";

type ApplicationEmojiUser = PartialUser & {
    toPublicUser?: () => PartialUser;
};

export type ApplicationEmojiRecord = {
    id: string;
    application_id?: string;
    name: string;
    animated: boolean;
    user?: ApplicationEmojiUser | null;
};

type ResolvedApplicationEmojiRepository = {
    findOne(options: unknown): Promise<ApplicationEmojiRecord | null>;
    save(emoji: ApplicationEmojiRecord): Promise<ApplicationEmojiRecord>;
    delete(criteria: unknown): Promise<unknown>;
};

export type ApplicationEmojiRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    emojiRepository?: {
        findOne(options: unknown): Promise<ApplicationEmojiRecord | null>;
        save?(emoji: ApplicationEmojiRecord): Promise<ApplicationEmojiRecord>;
        delete?(criteria: unknown): Promise<unknown>;
    };
};

const snowflakePattern = /^[1-9]\d{16,19}$/;
const applicationEmojiNamePattern = /^[A-Za-z0-9_]+$/;

function isRouteSnowflake(value: string) {
    return snowflakePattern.test(value);
}

function toPartialUser(user: ApplicationEmojiUser) {
    if (typeof user.toPublicUser === "function") return user.toPublicUser();

    return user;
}

export function serializeApplicationEmoji(emoji: ApplicationEmojiRecord): EmojiResponse {
    return {
        id: emoji.id,
        name: emoji.name,
        user: emoji.user ? toPartialUser(emoji.user) : undefined,
        require_colons: true,
        managed: false,
        animated: emoji.animated,
        available: true,
    };
}

function createDefaultEmojiRepository(): ResolvedApplicationEmojiRepository {
    return {
        findOne: (options: unknown) => ApplicationEmoji.findOne(options as Parameters<typeof ApplicationEmoji.findOne>[0]) as Promise<ApplicationEmojiRecord | null>,
        save: (emoji: ApplicationEmojiRecord) => ApplicationEmoji.save(emoji as ApplicationEmoji) as Promise<ApplicationEmojiRecord>,
        delete: (criteria: unknown) => ApplicationEmoji.delete(criteria as Parameters<typeof ApplicationEmoji.delete>[0]),
    };
}

function getEmojiRepository(repositories: ApplicationEmojiRepositories = {}): ResolvedApplicationEmojiRepository {
    const defaults = createDefaultEmojiRepository();
    const repository = repositories.emojiRepository;

    if (!repository) return defaults;

    return {
        findOne: repository.findOne,
        save: repository.save ?? defaults.save,
        delete: repository.delete ?? defaults.delete,
    };
}

async function getAuthorizedApplicationEmojiRecord(applicationId: string, emojiId: string, userId: string, repositories: ApplicationEmojiRepositories = {}) {
    if (!isRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationEmojiAccess(applicationId, userId, repositories.applicationRepository);

    const emojiRepository = getEmojiRepository(repositories);
    if (!isRouteSnowflake(emojiId)) return { emojiRepository, emoji: null };

    const emoji = await emojiRepository.findOne({
        where: {
            id: emojiId,
            application_id: applicationId,
        },
        relations: {
            user: true,
        },
    });

    return { emojiRepository, emoji };
}

function validateApplicationEmojiName(name: string) {
    if (name.length < 2 || name.length > 32) {
        throw FieldErrors({
            name: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: "Must be between 2 and 32 in length.",
            },
        });
    }

    if (!applicationEmojiNamePattern.test(name)) {
        throw FieldErrors({
            name: {
                code: "BASE_TYPE_INVALID",
                message: "Emoji names may only contain alphanumeric characters and underscores.",
            },
        });
    }
}

function isApplicationEmojiNameConflict(error: unknown) {
    const errorRecord = error as { code?: unknown; constraint?: unknown; message?: unknown };

    if (errorRecord.code === "23505") return true;
    if (errorRecord.constraint === "UQ_application_emojis_application_id_name") return true;
    if (typeof errorRecord.message !== "string") return false;

    return (
        errorRecord.message.includes("UQ_application_emojis_application_id_name") ||
        errorRecord.message.includes("application_emojis.application_id") ||
        errorRecord.message.includes("application_emojis_application_id_name")
    );
}

function throwDuplicateApplicationEmojiName() {
    throw FieldErrors({
        name: {
            code: "BASE_TYPE_ALREADY_EXISTS",
            message: "Name is already taken.",
        },
    });
}

export async function getApplicationEmoji(applicationId: string, emojiId: string, userId: string, repositories: ApplicationEmojiRepositories = {}) {
    const { emoji } = await getAuthorizedApplicationEmojiRecord(applicationId, emojiId, userId, repositories);

    return emoji ? serializeApplicationEmoji(emoji) : null;
}

export async function updateApplicationEmoji(
    applicationId: string,
    emojiId: string,
    userId: string,
    body: ApplicationEmojiModifySchema,
    repositories: ApplicationEmojiRepositories = {},
) {
    const { emojiRepository, emoji } = await getAuthorizedApplicationEmojiRecord(applicationId, emojiId, userId, repositories);
    if (!emoji) return null;

    if (body.name === undefined) return serializeApplicationEmoji(emoji);

    validateApplicationEmojiName(body.name);
    emoji.name = body.name;
    emoji.application_id ??= applicationId;

    try {
        const updatedEmoji = await emojiRepository.save(emoji);
        return serializeApplicationEmoji(updatedEmoji);
    } catch (error) {
        if (isApplicationEmojiNameConflict(error)) throwDuplicateApplicationEmojiName();
        throw error;
    }
}

export async function deleteApplicationEmoji(applicationId: string, emojiId: string, userId: string, repositories: ApplicationEmojiRepositories = {}) {
    const { emojiRepository, emoji } = await getAuthorizedApplicationEmojiRecord(applicationId, emojiId, userId, repositories);
    if (!emoji) return false;

    await emojiRepository.delete({
        id: emoji.id,
        application_id: applicationId,
    });

    return true;
}

function sendUnknownEmoji(res: Response) {
    return res.status(404).json({
        code: DiscordApiErrors.UNKNOWN_EMOJI.code,
        message: DiscordApiErrors.UNKNOWN_EMOJI.message,
    });
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createApplicationEmojiRouter(repositories: ApplicationEmojiRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            responses: {
                200: {
                    body: "EmojiResponse",
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
            try {
                const emoji = await getApplicationEmoji(req.params.application_id as string, req.params.emoji_id as string, req.user_id, repositories);
                if (!emoji) return sendUnknownEmoji(res);

                return res.status(200).json(emoji);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    router.patch(
        "/",
        route({
            requestBody: "ApplicationEmojiModifySchema",
            responses: {
                200: {
                    body: "EmojiResponse",
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
            try {
                const emoji = await updateApplicationEmoji(
                    req.params.application_id as string,
                    req.params.emoji_id as string,
                    req.user_id,
                    req.body as ApplicationEmojiModifySchema,
                    repositories,
                );
                if (!emoji) return sendUnknownEmoji(res);

                return res.status(200).json(emoji);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    router.delete(
        "/",
        route({
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
            try {
                const deleted = await deleteApplicationEmoji(req.params.application_id as string, req.params.emoji_id as string, req.user_id, repositories);
                if (!deleted) return sendUnknownEmoji(res);

                return res.sendStatus(204);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationEmojiRouter();

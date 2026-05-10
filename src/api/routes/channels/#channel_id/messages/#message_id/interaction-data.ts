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

import { route, serializeApplicationCommand } from "@spacebar/api";
import { ApplicationCommand, DiscordApiErrors, getPermission, Message } from "@spacebar/util";
import type { ApplicationCommandSchema, MessageInteractionDataResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { IsNull, type FindOptionsWhere } from "typeorm";

const router = Router({ mergeParams: true });

type StoredInteractionMetadata = NonNullable<Message["interaction_metadata"]> & {
    application_command_id?: string;
    application_command?: unknown;
    options?: MessageInteractionDataResponse["options"];
};

type MessageInteractionDataSource = Pick<Message, "application_id" | "interaction_metadata"> & {
    channel?: {
        guild_id?: string | null;
    } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function isApplicationCommandResponse(value: unknown): value is ApplicationCommandSchema {
    if (!isRecord(value)) return false;

    return (
        typeof value.id === "string" &&
        typeof value.application_id === "string" &&
        typeof value.name === "string" &&
        typeof value.description === "string" &&
        (value.default_member_permissions === null || typeof value.default_member_permissions === "string") &&
        typeof value.version === "string"
    );
}

function getInteractionMetadata(message: MessageInteractionDataSource): StoredInteractionMetadata {
    const metadata = message.interaction_metadata as StoredInteractionMetadata | undefined;
    if (!metadata?.id || metadata.type === undefined) throw DiscordApiErrors.UNKNOWN_INTERACTION;

    return metadata;
}

async function findApplicationCommandById(metadata: StoredInteractionMetadata, applicationId: string | undefined): Promise<ApplicationCommandSchema | undefined> {
    if (!metadata.application_command_id) return undefined;

    const where: FindOptionsWhere<ApplicationCommand> = { id: metadata.application_command_id };
    if (applicationId) where.application_id = applicationId;

    const command = await ApplicationCommand.findOne({ where });
    return command ? serializeApplicationCommand(command) : undefined;
}

async function findApplicationCommandByMetadata(metadata: StoredInteractionMetadata, applicationId: string | undefined, guildId: string | null | undefined) {
    if (!applicationId || !metadata.name) return undefined;

    const baseWhere: FindOptionsWhere<ApplicationCommand> = {
        application_id: applicationId,
        name: metadata.name,
        ...(metadata.command_type === undefined ? {} : { type: metadata.command_type }),
    };

    if (guildId) {
        const guildCommand = await ApplicationCommand.findOne({
            where: {
                ...baseWhere,
                guild_id: guildId,
            },
        });
        if (guildCommand) return serializeApplicationCommand(guildCommand);
    }

    const globalCommand = await ApplicationCommand.findOne({
        where: {
            ...baseWhere,
            guild_id: IsNull(),
        },
    });

    return globalCommand ? serializeApplicationCommand(globalCommand) : undefined;
}

async function getApplicationCommandForInteractionData(message: MessageInteractionDataSource, metadata: StoredInteractionMetadata): Promise<ApplicationCommandSchema> {
    const applicationId = message.application_id ?? undefined;
    const command =
        (await findApplicationCommandById(metadata, applicationId)) ??
        (await findApplicationCommandByMetadata(metadata, applicationId, message.channel?.guild_id)) ??
        (isApplicationCommandResponse(metadata.application_command) ? metadata.application_command : undefined);

    if (!command) throw DiscordApiErrors.UNKNOWN_INTERACTION;

    return command;
}

export async function buildMessageInteractionDataResponse(message: MessageInteractionDataSource): Promise<MessageInteractionDataResponse> {
    const metadata = getInteractionMetadata(message);
    const applicationCommand = await getApplicationCommandForInteractionData(message, metadata);

    return {
        id: metadata.id,
        type: metadata.type,
        name: metadata.name || applicationCommand.name,
        application_command: applicationCommand,
        ...(metadata.options === undefined ? {} : { options: metadata.options }),
    };
}

router.get(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        responses: {
            200: {
                body: "MessageInteractionDataResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {},
            404: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { message_id, channel_id } = req.params as { [key: string]: string };

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id },
            relations: {
                channel: true,
            },
        });

        if (message.author_id !== req.user_id) {
            const permissions = req.permission ?? (await getPermission(req.user_id, message.channel?.guild_id, channel_id));
            permissions.hasThrow("READ_MESSAGE_HISTORY");
        }

        return res.json(await buildMessageInteractionDataResponse(message));
    },
);

export default router;

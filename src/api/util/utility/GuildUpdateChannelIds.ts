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

import { Channel, FieldErrors } from "@spacebar/util";
import { GuildUpdateSchema } from "@spacebar/schemas";

type ChannelReferenceField = "afk_channel_id" | "system_channel_id" | "rules_channel_id" | "public_updates_channel_id";

type GuildChannelLookupOptions = {
    where: {
        guild_id: string;
        id: string;
    };
    select: {
        id: true;
    };
};

type ChannelFinder = (options: GuildChannelLookupOptions) => Promise<unknown>;

const CHANNEL_REFERENCE_FIELDS: readonly ChannelReferenceField[] = ["afk_channel_id", "system_channel_id", "rules_channel_id", "public_updates_channel_id"];
const CREATE_CHANNEL_SENTINEL_FIELDS = new Set<ChannelReferenceField>(["rules_channel_id", "public_updates_channel_id"]);

function isEntityNotFoundError(error: unknown) {
    return error instanceof Error && error.name === "EntityNotFoundError";
}

export async function ensureGuildUpdateChannelIdsExistInGuild(
    body: GuildUpdateSchema,
    guild_id: string,
    channelFinder: ChannelFinder = (options) => Channel.findOneOrFail(options),
) {
    const invalidFields: Record<string, { code: string; message: string }> = {};

    for (const field of CHANNEL_REFERENCE_FIELDS) {
        if (!(field in body)) continue;

        const channel_id = body[field];
        if (channel_id == null) continue;
        if (channel_id === "1" && CREATE_CHANNEL_SENTINEL_FIELDS.has(field)) continue;

        try {
            await channelFinder({
                where: { guild_id, id: channel_id },
                select: { id: true },
            });
        } catch (error) {
            if (!isEntityNotFoundError(error)) throw error;

            invalidFields[field] = {
                code: "CHANNEL_NOT_FOUND",
                message: "Channel does not exist in this guild",
            };
        }
    }

    if (Object.keys(invalidFields).length) throw FieldErrors(invalidFields);
}

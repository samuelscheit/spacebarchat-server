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

import type { PreloadMessageResponse } from "@spacebar/schemas";
import { emitEvent, type Message, type MessageDeleteBulkEvent } from "@spacebar/util";

export function toPreloadMessageResponse(message: Message): PreloadMessageResponse {
    // https://docs.discord.food/resources/message#preload-messages - reactions are not included in the response
    const { reactions, ...preloadMessage } = message.toJSON();
    void reactions;
    return preloadMessage;
}

export const DEFAULT_MESSAGE_DELETE_CHUNK_SIZE = 100;

type MessageDeleteBulkEventInput = {
    ids: string[];
    channel_id: string;
    guild_id?: string;
};

export type EmitMessageDeleteBulkEvent = (event: Omit<MessageDeleteBulkEvent, "created_at">) => Promise<void>;
export type DeleteMessageIds = (ids: string[]) => Promise<unknown>;

export function buildMessageDeleteBulkEvent(input: MessageDeleteBulkEventInput): Omit<MessageDeleteBulkEvent, "created_at"> {
    return {
        event: "MESSAGE_DELETE_BULK",
        channel_id: input.channel_id,
        data: {
            ids: input.ids,
            channel_id: input.channel_id,
            guild_id: input.guild_id,
        },
    };
}

export async function deleteMessagesAndEmitBulkEvents(
    input: MessageDeleteBulkEventInput,
    options: {
        chunkSize?: number;
        deleteMessageIds: DeleteMessageIds;
        emit?: EmitMessageDeleteBulkEvent;
    },
): Promise<number> {
    const chunkSize = options.chunkSize ?? DEFAULT_MESSAGE_DELETE_CHUNK_SIZE;
    if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error("chunkSize must be a positive integer");

    const emit = options.emit ?? emitEvent;
    let deleted = 0;

    for (let offset = 0; offset < input.ids.length; offset += chunkSize) {
        const ids = input.ids.slice(offset, offset + chunkSize);
        await options.deleteMessageIds(ids);
        await emit(
            buildMessageDeleteBulkEvent({
                ids,
                channel_id: input.channel_id,
                guild_id: input.guild_id,
            }),
        );
        deleted += ids.length;
    }

    return deleted;
}

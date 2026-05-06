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

export type PreloadMessageJson = {
    reactions?: unknown;
};

export type PreloadableMessage = {
    toJSON(): PreloadMessageJson;
};

export type PreloadMessagesOptions<T extends PreloadableMessage> = {
    getAuthorizedChannelIds(channelIds: string[]): Promise<Set<string>>;
    findLatestMessage(channelId: string): Promise<T | null>;
    serializeMessage?: (message: T) => PreloadMessageJson;
};

export function serializePreloadedMessage<T extends PreloadableMessage>(message: T) {
    const json = message.toJSON();
    json.reactions = undefined;
    return json;
}

export async function preloadAuthorizedMessages<T extends PreloadableMessage>(
    channelIds: string[],
    { getAuthorizedChannelIds, findLatestMessage, serializeMessage = serializePreloadedMessage }: PreloadMessagesOptions<T>,
) {
    const authorizedChannelIds = await getAuthorizedChannelIds(channelIds);
    const messages = (await Promise.all(channelIds.filter((channelId) => authorizedChannelIds.has(channelId)).map((channelId) => findLatestMessage(channelId)))).filter(
        (message) => message !== null,
    );

    return messages.map((message) => serializeMessage(message));
}

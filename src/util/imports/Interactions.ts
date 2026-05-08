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

import type { ApplicationCommandType, InteractionType } from "@spacebar/schemas";
import { DiscordApiErrors } from "../util/Constants";

export interface PendingInteraction {
    timeout: NodeJS.Timeout;
    token: string;
    applicationId: string;
    userId: string;
    channelId?: string;
    guildId?: string;
    nonce?: string;
    messageId?: string;
    type: InteractionType;
    commandType?: ApplicationCommandType;
    commandName?: string;
}

export const pendingInteractions = new Map<string, PendingInteraction>();

export function getPendingInteractionForCallback(interactionId: string, interactionToken: string | undefined): PendingInteraction | undefined {
    if (!interactionToken) return undefined;

    const interaction = pendingInteractions.get(interactionId);
    if (interaction?.token !== interactionToken) return undefined;

    return interaction;
}

export function requirePendingInteractionForCallback(interactionId: string, interactionToken: string | undefined): PendingInteraction {
    const interaction = getPendingInteractionForCallback(interactionId, interactionToken);
    if (!interaction) throw DiscordApiErrors.UNKNOWN_INTERACTION;

    return interaction;
}

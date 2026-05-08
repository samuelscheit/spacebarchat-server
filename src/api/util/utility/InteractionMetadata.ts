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

import type { ApplicationCommandType, InteractionType } from "@spacebar/schemas";

const applicationCommandInteractionType = 2 as InteractionType;
const chatInputCommandType = 1 as ApplicationCommandType;

interface ApplicationCommandInteractionMessageInput {
    commandName?: string;
    commandType?: ApplicationCommandType;
    interactionId: string;
    userId: string;
}

export function createApplicationCommandInteractionMessageData({ commandName, commandType, interactionId, userId }: ApplicationCommandInteractionMessageInput) {
    const name = commandName ?? "";

    return {
        interaction: {
            id: interactionId,
            name,
            type: applicationCommandInteractionType,
        },
        interaction_metadata: {
            id: interactionId,
            type: applicationCommandInteractionType,
            user_id: userId,
            authorizing_integration_owners: {
                "1": userId,
            },
            name,
            command_type: commandType ?? chatInputCommandType,
        },
    };
}

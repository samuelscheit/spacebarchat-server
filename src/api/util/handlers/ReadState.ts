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

import { AckBulkSchema, ReadStateType } from "../../../schemas/uncategorised/MessageAcknowledgeSchema";

export type AckBulkReadStateUpdate = AckBulkSchema["read_states"][number];

export interface ReadStateIdentity {
    user_id: string;
    channel_id: string;
    read_state_type: ReadStateType;
}

export interface WritableReadState {
    last_message_id?: string;
    mention_count: number;
    read_state_type: ReadStateType;
}

export function getReadStateType(update: AckBulkReadStateUpdate): ReadStateType {
    return update.read_state_type ?? ReadStateType.CHANNEL;
}

export function getReadStateIdentity(user_id: string, update: AckBulkReadStateUpdate): ReadStateIdentity {
    return {
        user_id,
        channel_id: update.channel_id,
        read_state_type: getReadStateType(update),
    };
}

export function applyAckBulkReadStateUpdate<T extends WritableReadState>(readState: T, update: AckBulkReadStateUpdate): T {
    const read_state_type = getReadStateType(update);
    readState.read_state_type = read_state_type;
    readState.last_message_id = update.message_id;

    if (read_state_type === ReadStateType.CHANNEL) {
        readState.mention_count = 0;
    }

    return readState;
}

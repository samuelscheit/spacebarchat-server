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

import { CLOSECODES, OPCODES, type Payload } from "../util/Constants";
import type { WebSocket } from "../util/WebSocket";
import { setHeartbeat } from "../util/Heartbeat";
import { Send } from "../util/Send";
import { Config, Session } from "@spacebar/util";
import { FindOptionsWhere } from "typeorm";
import { isValidHeartbeatPayload, type QoSHeartbeatData } from "./HeartbeatValidation";

export async function onHeartbeat(this: WebSocket, data: Payload) {
    if (!isValidHeartbeatPayload(data)) {
        return this.close(CLOSECODES.Decode_error);
    }

    setHeartbeat(this, Config.get().gateway.heartbeatTimeout);

    if (data.op === OPCODES.SetQoS) {
        this.qos = (data.d as QoSHeartbeatData).qos;
    }

    const ack = Send(this, { op: OPCODES.Heartbeat_ACK, d: {} });
    const authSessionId = this.session?.session_id;
    if (!this.user_id || !authSessionId) {
        await ack;
        return;
    }

    await Promise.all([
        ack,
        Session.update(
            {
                session_id: authSessionId,
                user_id: this.user_id,
            } as FindOptionsWhere<Session>,
            { last_seen: new Date() },
        ),
    ]);
}

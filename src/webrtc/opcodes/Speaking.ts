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

import { CLOSECODES } from "@spacebar/gateway";
import { mediaServer, VoiceOPCodes, VoicePayload, WebRtcWebSocket, Send } from "../util";

// {"speaking":1,"delay":5,"ssrc":2805246727}

export async function onSpeaking(this: WebRtcWebSocket, data: VoicePayload) {
    if (!this.webRtcClient) return;

    const body = data.d as { speaking?: unknown; ssrc?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.speaking !== "number" || typeof body.ssrc !== "number") return this.close(CLOSECODES.Decode_error);

    await Promise.all(
        Array.from(mediaServer.getClientsForRtcServer<WebRtcWebSocket>(this.webRtcClient.voiceRoomId)).map((client) => {
            if (client.user_id === this.user_id) return Promise.resolve();

            const ssrc = client.getOutgoingStreamSSRCsForUser(this.user_id);

            return Send(client.websocket, {
                op: VoiceOPCodes.SPEAKING,
                d: {
                    user_id: this.user_id,
                    speaking: body.speaking,
                    ssrc: ssrc.audio_ssrc ?? 0,
                },
            });
        }),
    );
}

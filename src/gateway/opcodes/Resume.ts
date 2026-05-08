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

import { CLOSECODES, OPCODES, Payload, Send, sendInvalidSessionAndClose, setupListener, WebSocket } from "@spacebar/gateway";
import { checkToken, Intents, Session } from "@spacebar/util";

interface ResumePayload {
    token: string;
    session_id: string;
    seq?: number | null;
}

export async function onResume(this: WebSocket, data: Payload) {
    if (this.user_id) return this.close(CLOSECODES.Already_authenticated);
    if (!isResumePayload(data.d)) return this.close(CLOSECODES.Decode_error);

    clearTimeout(this.readyTimeout);

    let tokenData: Awaited<ReturnType<typeof checkToken>>;
    try {
        tokenData = await checkToken(data.d.token);
    } catch {
        return rejectResume.call(this);
    }

    if (!tokenData.session || tokenData.session.session_id !== data.d.session_id) {
        return rejectResume.call(this);
    }

    this.accessToken = data.d.token;
    this.user_id = tokenData.user.id;
    this.session_id = tokenData.session.session_id;
    this.session = tokenData.session;
    this.intents = new Intents(0);
    this.sequence = (data.d.seq ?? -1) + 1;

    await Promise.all([
        Session.update(
            {
                session_id: this.session_id,
                user_id: this.user_id,
            },
            { last_seen: new Date() },
        ),
        setupListener.call(this),
    ]);

    await Send(this, {
        op: OPCODES.Dispatch,
        t: "RESUMED",
        s: this.sequence++,
        d: {
            _trace: [],
        },
    });
}

async function rejectResume(this: WebSocket) {
    return sendInvalidSessionAndClose(this, false);
}

function isResumePayload(value: unknown): value is ResumePayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const payload = value as Partial<ResumePayload>;
    return (
        typeof payload.token === "string" &&
        payload.token.length > 0 &&
        typeof payload.session_id === "string" &&
        payload.session_id.length > 0 &&
        (payload.seq === undefined || payload.seq === null || (typeof payload.seq === "number" && Number.isFinite(payload.seq)))
    );
}

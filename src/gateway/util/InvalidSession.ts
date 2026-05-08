import { OPCODES } from "./Constants";
import { Send } from "./Send";
import type { WebSocket } from "./WebSocket";

export const INVALID_SESSION_CLOSE_CODE = 1000;

export async function sendInvalidSession(socket: WebSocket, resumable = false) {
    await Send(socket, {
        op: OPCODES.Invalid_Session,
        d: resumable,
        s: socket.sequence++,
    });
}

export async function sendInvalidSessionAndClose(socket: WebSocket, resumable = false) {
    try {
        await sendInvalidSession(socket, resumable);
    } finally {
        socket.close(INVALID_SESSION_CLOSE_CODE);
    }
}

import { OPCODES, Payload } from "./Constants";
import { Send } from "./Send";
import type { WebSocket } from "./WebSocket";

export const INVALID_SESSION_CLOSE_CODE = 1000;

export interface InvalidSessionOptions {
    resumable?: boolean;
}

export interface InvalidSessionCloseOptions extends InvalidSessionOptions {
    closeCode?: number;
}

export function createInvalidSessionPayload(resumable: boolean = false): Payload {
    return {
        op: OPCODES.Invalid_Session,
        d: resumable,
    };
}

export async function sendInvalidSession(socket: WebSocket, options: InvalidSessionOptions = {}) {
    await Send(socket, createInvalidSessionPayload(options.resumable ?? false));
}

export async function sendInvalidSessionAndClose(socket: WebSocket, options: InvalidSessionCloseOptions = {}) {
    try {
        await sendInvalidSession(socket, options);
    } finally {
        socket.close(options.closeCode ?? INVALID_SESSION_CLOSE_CODE);
    }
}

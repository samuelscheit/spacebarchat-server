import { CLOSECODES, OPCODES, Payload } from "./Constants";
import { Send } from "./Send";
import type { WebSocket } from "./WebSocket";

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
        socket.close(options.closeCode ?? CLOSECODES.Invalid_session);
    }
}

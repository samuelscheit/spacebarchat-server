import { Send } from "./Send";
import type { WebSocket } from "./WebSocket";
import { createReconnectPayload } from "./ReconnectPayload";

export async function sendReconnect(socket: WebSocket, reconnectDelay: number = 1000) {
    await Send(socket, createReconnectPayload(reconnectDelay, socket.sequence++));
}

export async function sendReconnectAndClose(socket: WebSocket, reconnectDelay: number = 1000, closeCode: number = 1000) {
    try {
        await sendReconnect(socket, reconnectDelay);
    } finally {
        socket.close(closeCode);
    }
}

export async function broadcastReconnect(sockets: Iterable<WebSocket>, reconnectDelay: number = 1000) {
    await Promise.allSettled(
        [...sockets].map(async (socket) => {
            if (socket.readyState !== socket.OPEN) return;
            await sendReconnect(socket, reconnectDelay);
        }),
    );
}

import type { EventOpts } from "@spacebar/util";
import { sendInvalidSessionAndClose } from "../util/InvalidSessionPayload";
import { sendReconnectAndClose } from "../util/Reconnect";
import type { WebSocket } from "../util/WebSocket";
import { getEventRouteId } from "./subscriptions";

export async function handlePreDispatchGatewayEvent(socket: WebSocket, opts: EventOpts): Promise<boolean> {
    const eventRouteId = getEventRouteId(opts);
    opts.acknowledge?.();
    if (eventRouteId && !socket.events[eventRouteId]) return true;

    if (opts.transaction_id) {
        if (socket.recentTransactions.includes(opts.transaction_id)) return true;
        socket.recentTransactions.push(opts.transaction_id);
        if (socket.recentTransactions.length > 100) socket.recentTransactions = socket.recentTransactions.slice(1);
    }

    return handleSessionControlEvent(socket, opts);
}

export async function handleSessionControlEvent(socket: WebSocket, opts: Pick<EventOpts, "data" | "event" | "reconnect_delay">): Promise<boolean> {
    switch (opts.event) {
        case "SB_SESSION_CLOSE":
            await sendReconnectAndClose(socket, opts.reconnect_delay ?? opts.data ?? 1000);
            return true;
        case "SB_SESSION_REMOVE":
            await sendInvalidSessionAndClose(socket, { resumable: false });
            return true;
        default:
            return false;
    }
}

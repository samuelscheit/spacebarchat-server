import WS from "ws";

export const DISCONNECTED_SESSION_CLEANUP_DELAY_MS = 10_000;

type Delay = (ms: number) => Promise<void>;

const delay: Delay = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export type GatewayShutdownClient = {
    close: (code?: number, reason?: string | Buffer) => void;
    once: (event: "close", listener: () => void) => unknown;
    readyState: number;
    closeCleanup?: Promise<unknown>;
};

export type GatewayShutdownServer = {
    clients: Set<GatewayShutdownClient>;
    close: (callback?: (error?: Error) => void) => void;
};

export async function runDelayedGatewayCloseCleanup(cleanup: () => Promise<void>, delayMs = DISCONNECTED_SESSION_CLEANUP_DELAY_MS, wait: Delay = delay) {
    await wait(delayMs);
    await cleanup();
}

export function waitForGatewayClientClose(client: GatewayShutdownClient, closeCode = 1001, closeReason = "Gateway shutdown") {
    if (client.readyState === WS.CLOSED) return client.closeCleanup ?? Promise.resolve();

    const closed = new Promise<void>((resolve) => {
        client.once("close", () => resolve());
    });
    if (client.readyState !== WS.CLOSING) client.close(closeCode, closeReason);

    return closed.then(() => client.closeCleanup);
}

export async function waitForGatewayClientsClose(clients: Set<GatewayShutdownClient>, closeCode = 1001, closeReason = "Gateway shutdown") {
    while (clients.size) {
        const snapshot = Array.from(clients);
        const closableClients = snapshot.filter((client) => client.readyState !== WS.CLOSED);

        if (!closableClients.length) {
            await Promise.all(snapshot.map((client) => client.closeCleanup ?? Promise.resolve()));
            return;
        }

        await Promise.all(closableClients.map((client) => waitForGatewayClientClose(client, closeCode, closeReason)));
    }
}

export async function closeGatewayServer(server: GatewayShutdownServer, closeCode = 1001, closeReason = "Gateway shutdown") {
    const closed = new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });

    await waitForGatewayClientsClose(server.clients, closeCode, closeReason);
    await closed;
}

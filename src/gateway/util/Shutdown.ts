import WS from "ws";

export type GatewayShutdownClient = {
    close: (code?: number, reason?: string | Buffer) => void;
    once: (event: "close", listener: () => void) => unknown;
    readyState: number;
    closeCleanup?: Promise<unknown>;
};

export function waitForGatewayClientClose(client: GatewayShutdownClient, closeCode = 1001, closeReason = "Gateway shutdown") {
    if (client.readyState === WS.CLOSED) return client.closeCleanup ?? Promise.resolve();

    const closed = new Promise<void>((resolve) => {
        client.once("close", () => resolve());
    });
    if (client.readyState !== WS.CLOSING) client.close(closeCode, closeReason);

    return closed.then(() => client.closeCleanup);
}

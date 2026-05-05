type SignalProcess = Pick<typeof process, "exit" | "once">;

export function installSignalShutdown(stop: () => Promise<void>, signalProcess: SignalProcess = process) {
    let stopping = false;

    const shutdown = async (signal: NodeJS.Signals) => {
        if (stopping) return;
        stopping = true;

        console.log(`[Gateway] shutting down due to ${signal}`);
        try {
            await stop();
            signalProcess.exit(0);
        } catch (error) {
            console.error("[Gateway] shutdown failed", error);
            signalProcess.exit(1);
        }
    };

    for (const signal of ["SIGINT", "SIGTERM", "SIGQUIT"] as const) {
        signalProcess.once(signal, shutdown);
    }
}

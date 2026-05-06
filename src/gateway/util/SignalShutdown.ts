type SignalHandler = (signal: NodeJS.Signals) => void | Promise<void>;
type SignalProcess = {
    exit: typeof process.exit;
    off: (signal: NodeJS.Signals, handler: SignalHandler) => unknown;
    on: (signal: NodeJS.Signals, handler: SignalHandler) => unknown;
};
type SignalShutdownDisposer = () => void;

const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"] as const;
const signalShutdownDisposers = new WeakMap<SignalProcess, SignalShutdownDisposer>();

export function installSignalShutdown(stop: () => Promise<void>, signalProcess: SignalProcess = process): SignalShutdownDisposer {
    signalShutdownDisposers.get(signalProcess)?.();

    let stopping = false;
    let disposed = false;

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

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const signal of shutdownSignals) {
            signalProcess.off(signal, shutdown);
        }
        if (signalShutdownDisposers.get(signalProcess) === dispose) signalShutdownDisposers.delete(signalProcess);
    };

    for (const signal of shutdownSignals) {
        signalProcess.on(signal, shutdown);
    }

    signalShutdownDisposers.set(signalProcess, dispose);
    return dispose;
}

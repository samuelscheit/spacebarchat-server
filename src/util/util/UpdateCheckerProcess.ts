export const UPDATE_CHECKER_WORKER_ENV = "SPACEBAR_UPDATE_CHECKER_WORKER";

export function getUpdateCheckerWorkerEnv(enabled: boolean): NodeJS.ProcessEnv {
    return { [UPDATE_CHECKER_WORKER_ENV]: enabled ? "true" : "false" };
}

export function shouldRunUpdateCheckerInCurrentProcess(isClusterWorker: boolean): boolean {
    const workerSetting = process.env[UPDATE_CHECKER_WORKER_ENV];
    if (workerSetting !== undefined) return workerSetting === "true";

    return !isClusterWorker;
}

export class UpdateCheckerWorkerElection {
    private updateCheckerWorkerId: number | undefined;

    shouldRunInitialWorker(index: number): boolean {
        return index === 0;
    }

    recordForkedWorker(workerId: number, runUpdateChecker: boolean): void {
        if (runUpdateChecker) this.updateCheckerWorkerId = workerId;
    }

    shouldRunReplacementForExitedWorker(workerId: number): boolean {
        return workerId === this.updateCheckerWorkerId;
    }
}

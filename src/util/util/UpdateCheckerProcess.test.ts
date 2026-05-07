import assert from "node:assert/strict";
import { test } from "node:test";
import { getUpdateCheckerWorkerEnv, shouldRunUpdateCheckerInCurrentProcess, UPDATE_CHECKER_WORKER_ENV, UpdateCheckerWorkerElection } from "./UpdateCheckerProcess";

test("getUpdateCheckerWorkerEnv marks the elected update-check worker explicitly", () => {
    assert.deepEqual(getUpdateCheckerWorkerEnv(true), { [UPDATE_CHECKER_WORKER_ENV]: "true" });
    assert.deepEqual(getUpdateCheckerWorkerEnv(false), { [UPDATE_CHECKER_WORKER_ENV]: "false" });
});

test("shouldRunUpdateCheckerInCurrentProcess uses explicit worker election before cluster defaults", () => {
    const original = process.env[UPDATE_CHECKER_WORKER_ENV];

    try {
        delete process.env[UPDATE_CHECKER_WORKER_ENV];
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(false), true);
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(true), false);

        process.env[UPDATE_CHECKER_WORKER_ENV] = "true";
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(true), true);
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(false), true);

        process.env[UPDATE_CHECKER_WORKER_ENV] = "false";
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(true), false);
        assert.equal(shouldRunUpdateCheckerInCurrentProcess(false), false);
    } finally {
        if (original === undefined) delete process.env[UPDATE_CHECKER_WORKER_ENV];
        else process.env[UPDATE_CHECKER_WORKER_ENV] = original;
    }
});

test("UpdateCheckerWorkerElection keeps exactly one elected replacement worker after restarts", () => {
    const election = new UpdateCheckerWorkerElection();

    assert.equal(election.shouldRunInitialWorker(0), true);
    assert.equal(election.shouldRunInitialWorker(1), false);

    election.recordForkedWorker(1, true);
    election.recordForkedWorker(2, false);

    assert.equal(election.shouldRunReplacementForExitedWorker(2), false);
    assert.equal(election.shouldRunReplacementForExitedWorker(1), true);

    election.recordForkedWorker(3, true);

    assert.equal(election.shouldRunReplacementForExitedWorker(1), false);
    assert.equal(election.shouldRunReplacementForExitedWorker(3), true);
});

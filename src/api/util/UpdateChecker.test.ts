import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildGitHubBranchApiUrl,
    buildGitHubCompareApiUrl,
    findStaffUsers,
    getUpdateCheckerTimerState,
    runUpdateCheck,
    startUpdateChecker,
    stopUpdateChecker,
    UpdateCheckerConfig,
    UpdateCheckerDependencies,
} from "./UpdateChecker";
import {
    buildUpdateNotificationMessage,
    hasStaffUserFlag,
    shouldFetchUpdateComparison,
    shouldNotifyUpdate,
    shouldRecordNotificationDelivery,
    summarizeCommitMessages,
} from "./UpdateCheckerMessages";
import { User } from "@spacebar/util";

const config: UpdateCheckerConfig = {
    enabled: true,
    repository: "spacebarchat/server",
    branch: "mistress",
    intervalSeconds: 60,
    requestTimeoutSeconds: 15,
    lastNotifiedCommit: null,
};

test("shouldNotifyUpdate only notifies for unseen newer commits when GitHub says the branch is ahead", () => {
    assert.equal(shouldFetchUpdateComparison(null, "def", null), false);
    assert.equal(shouldFetchUpdateComparison("abc", null, null), false);
    assert.equal(shouldFetchUpdateComparison("abc", "abc", null), false);
    assert.equal(shouldFetchUpdateComparison("abc", "def", "def"), false);
    assert.equal(shouldFetchUpdateComparison("abc", "def", null), true);
    assert.equal(shouldFetchUpdateComparison("abc", "def", "abc"), true);

    assert.equal(shouldNotifyUpdate("abc", "def", null, "ahead"), true);
    assert.equal(shouldNotifyUpdate("abc", "def", null, "behind"), false);
    assert.equal(shouldNotifyUpdate("abc", "def", null, "diverged"), false);
    assert.equal(shouldNotifyUpdate("abc", "def", null, "identical"), false);
    assert.equal(shouldNotifyUpdate("abc", "def", null, null), false);
});

test("shouldRecordNotificationDelivery only advances the marker after all attempted DMs succeed", () => {
    assert.equal(shouldRecordNotificationDelivery({ attempted: 0, sent: 0 }), false);
    assert.equal(shouldRecordNotificationDelivery({ attempted: 2, sent: 1 }), false);
    assert.equal(shouldRecordNotificationDelivery({ attempted: 2, sent: 2 }), true);
});

test("buildGitHub API urls encodes repository segments and branch names", () => {
    assert.equal(
        buildGitHubBranchApiUrl({ repository: "spacebarchat/server", branch: "release/2026.05#1" }),
        "https://api.github.com/repos/spacebarchat/server/branches/release%2F2026.05%231",
    );
    assert.equal(
        buildGitHubCompareApiUrl({ repository: "spacebarchat/server" }, "feature/current#1", "release/latest#2"),
        "https://api.github.com/repos/spacebarchat/server/compare/feature%2Fcurrent%231...release%2Flatest%232",
    );
});

test("hasStaffUserFlag matches the STAFF bit without requiring public flags", () => {
    assert.equal(hasStaffUserFlag(0), false);
    assert.equal(hasStaffUserFlag(1), true);
    assert.equal(hasStaffUserFlag(1n << 12n), false);
    assert.equal(hasStaffUserFlag((1n << 12n) | 1n), true);
});

test("findStaffUsers pushes STAFF flag filtering into the database query", async () => {
    const originalFind = User.find;
    let capturedOptions: Parameters<typeof User.find>[0] | undefined;
    const databaseUsers = [{ id: "from-db", flags: 0 }] as Pick<User, "id" | "flags">[];

    try {
        User.find = (async (options?: Parameters<typeof User.find>[0]) => {
            capturedOptions = options;
            return databaseUsers;
        }) as typeof User.find;

        assert.equal(await findStaffUsers(), databaseUsers);
    } finally {
        User.find = originalFind;
    }

    const where = (capturedOptions as { where: { disabled: boolean; deleted: boolean; flags: unknown } }).where;
    assert.equal(where.disabled, false);
    assert.equal(where.deleted, false);
    assert.ok(where.flags);
});

test("summarizeCommitMessages formats human-readable commit subjects", () => {
    assert.equal(
        summarizeCommitMessages([
            { sha: "1", commit: { message: "Fix gateway reconnects\n\nBody" } },
            { sha: "2", commit: { message: "Document config option" } },
        ]),
        "- Fix gateway reconnects\n- Document config option",
    );

    assert.equal(
        summarizeCommitMessages(
            [
                { sha: "1", commit: { message: "One" } },
                { sha: "2", commit: { message: "Two" } },
                { sha: "3", commit: { message: "Three" } },
            ],
            2,
        ),
        "- One\n- Two\n- ...and 1 more commit.",
    );
});

test("buildUpdateNotificationMessage includes commits and compare link", () => {
    const message = buildUpdateNotificationMessage({
        repository: "spacebarchat/server",
        branch: "mistress",
        currentCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        latestCommit: {
            sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            commit: {
                committer: {
                    date: "2026-05-06T00:00:00Z",
                },
            },
        },
        compareUrl: "https://github.com/spacebarchat/server/compare/a...b",
        commits: [{ sha: "bbbbbbb", commit: { message: "Add update checker" } }],
    });

    assert.match(message.content, /new Spacebar server update is available/);
    assert.equal(message.embeds[0].title, "✨ Spacebar update available");
    assert.match(message.embeds[0].description, /`aaaaaaa`/);
    assert.match(message.embeds[0].description, /`bbbbbbb`/);
    assert.match(message.embeds[0].fields[0].value, /Add update checker/);
    assert.equal(message.embeds[0].timestamp?.toISOString(), "2026-05-06T00:00:00.000Z");
});

test("runUpdateCheck notifies and records only when the configured branch is ahead", async () => {
    const calls = {
        notify: 0,
        record: 0,
    };

    const dependencies: UpdateCheckerDependencies = {
        getConfig: () => config,
        getCurrentCommit: () => "current",
        fetchLatestBranchCommit: async () => ({ sha: "latest" }),
        fetchCommitsSince: async () => ({ html_url: "https://github.com/spacebarchat/server/compare/current...latest", status: "ahead", commits: [] }),
        notifyStaffUsers: async () => {
            calls.notify++;
            return { attempted: 1, sent: 1 };
        },
        setLastNotifiedCommit: async (_config, lastNotifiedCommit) => {
            calls.record++;
            assert.equal(lastNotifiedCommit, "latest");
        },
        logError: (_message, error) => assert.fail(String(error)),
    };

    await runUpdateCheck(dependencies);

    assert.deepEqual(calls, { notify: 1, record: 1 });
});

test("runUpdateCheck suppresses notifications when the running commit is not behind the configured branch", async () => {
    for (const status of ["behind", "diverged", "identical", null] as const) {
        let notified = false;
        let recorded = false;

        await runUpdateCheck({
            getConfig: () => config,
            getCurrentCommit: () => "current",
            fetchLatestBranchCommit: async () => ({ sha: "latest" }),
            fetchCommitsSince: async () => ({ html_url: null, status, commits: [] }),
            notifyStaffUsers: async () => {
                notified = true;
                return { attempted: 1, sent: 1 };
            },
            setLastNotifiedCommit: async () => {
                recorded = true;
            },
            logError: (_message, error) => assert.fail(String(error)),
        });

        assert.equal(notified, false, `unexpected notification for ${status}`);
        assert.equal(recorded, false, `unexpected marker update for ${status}`);
    }
});

test("runUpdateCheck gives each GitHub request its own timeout signal", async () => {
    const signals: AbortSignal[] = [];

    await runUpdateCheck({
        getConfig: () => config,
        getCurrentCommit: () => "current",
        fetchLatestBranchCommit: async (_config, signal) => {
            assert(signal);
            signals.push(signal);
            return { sha: "latest" };
        },
        fetchCommitsSince: async (_config, _currentCommit, _latestCommit, signal) => {
            assert(signal);
            signals.push(signal);
            return { html_url: null, status: "ahead", commits: [] };
        },
        notifyStaffUsers: async () => ({ attempted: 1, sent: 1 }),
        setLastNotifiedCommit: async () => undefined,
        logError: (_message, error) => assert.fail(String(error)),
    });

    assert.equal(signals.length, 2);
    assert.notEqual(signals[0], signals[1]);
});

test("runUpdateCheck does not advance lastNotifiedCommit after a partial notification failure", async () => {
    let notifyAttempts = 0;
    let recorded = false;

    const dependencies: UpdateCheckerDependencies = {
        getConfig: () => config,
        getCurrentCommit: () => "current",
        fetchLatestBranchCommit: async () => ({ sha: "latest" }),
        fetchCommitsSince: async () => ({ html_url: null, status: "ahead", commits: [] }),
        notifyStaffUsers: async () => {
            notifyAttempts++;
            return { attempted: 2, sent: 1 };
        },
        setLastNotifiedCommit: async () => {
            recorded = true;
        },
        logError: (_message, error) => assert.fail(String(error)),
    };

    await runUpdateCheck(dependencies);
    await runUpdateCheck(dependencies);

    assert.equal(notifyAttempts, 2);
    assert.equal(recorded, false);
});

test("stopUpdateChecker clears both interval and delayed initial update check", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDisableUpdateChecks = process.env.DISABLE_UPDATE_CHECKS;
    const originalWorkerSetting = process.env.SPACEBAR_UPDATE_CHECKER_WORKER;

    try {
        delete process.env.NODE_ENV;
        delete process.env.DISABLE_UPDATE_CHECKS;
        process.env.SPACEBAR_UPDATE_CHECKER_WORKER = "true";

        stopUpdateChecker();
        startUpdateChecker();
        assert.deepEqual(getUpdateCheckerTimerState(), { initial: true, interval: true });

        startUpdateChecker();
        assert.deepEqual(getUpdateCheckerTimerState(), { initial: true, interval: true });

        stopUpdateChecker();
        assert.deepEqual(getUpdateCheckerTimerState(), { initial: false, interval: false });
    } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalDisableUpdateChecks === undefined) delete process.env.DISABLE_UPDATE_CHECKS;
        else process.env.DISABLE_UPDATE_CHECKS = originalDisableUpdateChecks;
        if (originalWorkerSetting === undefined) delete process.env.SPACEBAR_UPDATE_CHECKER_WORKER;
        else process.env.SPACEBAR_UPDATE_CHECKER_WORKER = originalWorkerSetting;
        stopUpdateChecker();
    }
});
